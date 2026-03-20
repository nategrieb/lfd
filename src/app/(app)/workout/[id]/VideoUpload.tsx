'use client'

/**
 * VideoUpload — records or selects a video for a single set, processes it
 * with FFmpeg WASM to burn in a metadata overlay, then uploads the result to
 * the `workout-videos` Supabase Storage bucket.
 *
 * Font setup (one-time):
 *   mkdir -p public/fonts
 *   curl -fsSL -o public/fonts/NotoSans-Bold.ttf \
 *     'https://github.com/notofonts/noto-fonts/raw/main/hinted/ttf/NotoSans/NotoSans-Bold.ttf'
 *
 * If the font file is absent the overlay is skipped and the raw video is
 * uploaded unchanged.
 *
 * Database migration (run once in Supabase SQL editor):
 *   ALTER TABLE sets ADD COLUMN IF NOT EXISTS video_url TEXT;
 *
 * Storage bucket (create once in Supabase dashboard):
 *   Bucket name : workout-videos
 *   Public      : true  (so getPublicUrl works without signed URLs)
 *   RLS policy  : allow INSERT / SELECT where (storage.foldername(name))[1] = auth.uid()::text
 */

import type { FFmpeg } from '@ffmpeg/ffmpeg'
import { useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { saveSetVideoUrl, deleteSetVideoUrl, saveSetThumbnailUrl } from '../actions'

// @ffmpeg/core single-thread build — no SharedArrayBuffer / COOP/COEP needed.
const CDN = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd'

type OverlayData = {
  exerciseName: string
  weight: number
  reps: number
  rpe: number | null
  oneRepMax: number | null
}

/**
 * Reads the actual pixel dimensions from a video file without decoding any frames.
 * Falls back to 1920×1080 if metadata cannot be read.
 */
function getVideoDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const video = document.createElement('video')
    const url = URL.createObjectURL(file)
    const cleanup = () => URL.revokeObjectURL(url)
    video.onloadedmetadata = () => {
      cleanup()
      resolve({ width: video.videoWidth || 1920, height: video.videoHeight || 1080 })
    }
    video.onerror = () => { cleanup(); resolve({ width: 1920, height: 1080 }) }
    video.src = url
  })
}

const GREEN_DARK = '#166534'
const GREEN_MID  = '#16a34a'
const FONT = 'system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif'

/**
 * Renders a full-frame transparent PNG with branded metadata baked into
 * the video itself so clips keep their lifting context when shared outside LFD.
 */
function renderOverlayPng(
  data: OverlayData,
  videoWidth: number,
  videoHeight: number,
): Promise<Uint8Array<ArrayBuffer>> {
  return new Promise((resolve, reject) => {
    const W = videoWidth
    const H = videoHeight
    const canvas = document.createElement('canvas')
    canvas.width = W
    canvas.height = H
    const ctx = canvas.getContext('2d')
    if (!ctx) { reject(new Error('Canvas unavailable')); return }

    // Corner watermark: square LFD mark.
    const CORNER = Math.max(40, Math.round(Math.min(W, H) * 0.055))
    const cornerX = W - CORNER - 20
    const cornerY = 20
    const cornerGrad = ctx.createLinearGradient(cornerX, cornerY, cornerX + CORNER, cornerY + CORNER)
    cornerGrad.addColorStop(0, GREEN_DARK)
    cornerGrad.addColorStop(1, GREEN_MID)
    ctx.fillStyle = cornerGrad
    ctx.fillRect(cornerX, cornerY, CORNER, CORNER)
    ctx.font = `900 ${Math.round(CORNER * 0.34)}px ${FONT}`
    ctx.fillStyle = '#FFFFFF'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('LFD', cornerX + CORNER / 2, cornerY + CORNER / 2)

    // In-frame metadata card at bottom-left.
    const cardW = Math.min(W - 32, Math.max(320, Math.round(W * 0.78)))
    const cardH = Math.max(86, Math.round(H * 0.14))
    const cardX = 16
    const cardY = H - cardH - 18
    const cardR = 14

    ctx.fillStyle = 'rgba(0,0,0,0.66)'
    ctx.beginPath()
    ctx.roundRect(cardX, cardY, cardW, cardH, cardR)
    ctx.fill()

    // Green accent bar to carry brand color.
    ctx.fillStyle = GREEN_MID
    ctx.beginPath()
    ctx.roundRect(cardX, cardY, cardW, 4, 4)
    ctx.fill()

    // Small brand square inside card.
    const badgeSize = 18
    const badgeX = cardX + 14
    const badgeY = cardY + 12
    const badgeGrad = ctx.createLinearGradient(badgeX, badgeY, badgeX + badgeSize, badgeY + badgeSize)
    badgeGrad.addColorStop(0, GREEN_DARK)
    badgeGrad.addColorStop(1, GREEN_MID)
    ctx.fillStyle = badgeGrad
    ctx.fillRect(badgeX, badgeY, badgeSize, badgeSize)
    ctx.font = `900 8px ${FONT}`
    ctx.fillStyle = '#FFFFFF'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('LFD', badgeX + badgeSize / 2, badgeY + badgeSize / 2)

    const title = data.exerciseName.toUpperCase()
    const parts = [`${data.weight} lbs x ${data.reps}`]
    if (data.rpe !== null) parts.push(`RPE ${data.rpe}`)
    if (data.oneRepMax) parts.push(`${Math.round((data.weight / data.oneRepMax) * 100)}% 1RM`)

    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'
    ctx.fillStyle = '#FFFFFF'
    ctx.font = `800 ${Math.max(16, Math.round(cardH * 0.24))}px ${FONT}`
    ctx.fillText(title, badgeX + badgeSize + 10, cardY + 27)

    ctx.fillStyle = '#D4D4D8'
    ctx.font = `600 ${Math.max(14, Math.round(cardH * 0.22))}px ${FONT}`
    ctx.fillText(parts.join('  •  '), cardX + 14, cardY + cardH - 16)

    canvas.toBlob((blob) => {
      if (!blob) { reject(new Error('Canvas toBlob failed')); return }
      blob.arrayBuffer().then(
        (buf) => resolve(new Uint8Array(buf) as Uint8Array<ArrayBuffer>),
        reject,
      )
    }, 'image/png')
  })
}

/**
 * Seeks to the middle of `videoBlob` and captures a JPEG frame.
 * Uses the processed (already-branded) video so the thumbnail has the
 * LFD overlay baked in when it appears on Strava.
 */
function captureMiddleFrame(videoBlob: Blob): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    const url = URL.createObjectURL(videoBlob)
    video.src = url
    video.muted = true
    video.preload = 'metadata'
    video.onloadedmetadata = () => {
      video.currentTime = video.duration / 2
    }
    video.onseeked = () => {
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) { URL.revokeObjectURL(url); reject(new Error('Canvas unavailable')); return }
      ctx.drawImage(video, 0, 0)
      URL.revokeObjectURL(url)
      canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error('Frame capture failed')),
        'image/jpeg',
        0.85,
      )
    }
    video.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Video load failed')) }
  })
}

export type VideoUploadProps = {
  setId: string
  workoutId: string
  exerciseName: string
  weight: number
  reps: number
  rpe?: number | null
  oneRepMax?: number | null
  initialVideoUrl?: string | null
  onOpenReel?: () => void
  onVideoUrlChange?: (url: string | null) => void
}

type Status =
  | { type: 'idle' }
  | { type: 'loading-ffmpeg' }
  | { type: 'processing'; progress: number }
  | { type: 'uploading' }
  | { type: 'done'; url: string }
  | { type: 'deleting' }
  | { type: 'error'; message: string }

export default function VideoUpload({
  setId,
  workoutId,
  exerciseName,
  weight,
  reps,
  rpe,
  oneRepMax,
  initialVideoUrl,
  onOpenReel,
  onVideoUrlChange,
}: VideoUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const ffmpegRef = useRef<FFmpeg | null>(null)
  const [status, setStatus] = useState<Status>(
    initialVideoUrl ? { type: 'done', url: initialVideoUrl } : { type: 'idle' },
  )

  /** Lazily load the FFmpeg instance (only runs in the browser). */
  const getFFmpeg = async (): Promise<FFmpeg> => {
    if (ffmpegRef.current) return ffmpegRef.current

    // Dynamic imports ensure this code path never executes during SSR.
    const { FFmpeg: FFmpegClass } = await import('@ffmpeg/ffmpeg')
    const { toBlobURL } = await import('@ffmpeg/util')

    const ffmpeg = new FFmpegClass()
    ffmpeg.on('progress', ({ progress }: { progress: number }) => {
      setStatus({ type: 'processing', progress: Math.round(Math.min(progress, 1) * 100) })
    })

    setStatus({ type: 'loading-ffmpeg' })
    await ffmpeg.load({
      coreURL: await toBlobURL(`${CDN}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${CDN}/ffmpeg-core.wasm`, 'application/wasm'),
    })

    ffmpegRef.current = ffmpeg
    return ffmpeg
  }

  const processAndUpload = async (file: File) => {
    try {
      const { fetchFile } = await import('@ffmpeg/util')
      const ffmpeg = await getFFmpeg()

      setStatus({ type: 'processing', progress: 0 })

      // Write the source video into the WASM virtual FS.
      await ffmpeg.writeFile('input.mp4', await fetchFile(file))

      // Detect the video's actual pixel dimensions so the overlay canvas
      // matches exactly — full-frame PNG needed for top-right LFD badge.
      const { width: videoWidth, height: videoHeight } = await getVideoDimensions(file)

      // Render the metadata overlay as a PNG using the browser's Canvas API.
      const overlayPng = await renderOverlayPng({
        exerciseName,
        weight,
        reps,
        rpe: rpe ?? null,
        oneRepMax: oneRepMax ?? null,
      }, videoWidth, videoHeight)
      await ffmpeg.writeFile('overlay.png', overlayPng)

      const ffmpegLogs: string[] = []
      ffmpeg.on('log', ({ message }: { message: string }) => {
        ffmpegLogs.push(message)
      })

      // overlay=0:H-h places the PNG flush to the bottom-left of the video.
      const exitCode = await ffmpeg.exec([
        '-i', 'input.mp4',
        '-i', 'overlay.png',
        // overlay=0:0 — PNG is full-frame so it composites from the top-left corner.
        '-filter_complex', '[0:v][1:v]overlay=0:0',
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', '23',
        '-pix_fmt', 'yuv420p',
        '-an',
        '-movflags', '+faststart',
        'output.mp4',
      ])

      if (exitCode !== 0) {
        const tail = ffmpegLogs.slice(-6).join('\n')
        throw new Error(`FFmpeg error (code ${exitCode}):\n${tail}`)
      }

      const outputData = await ffmpeg.readFile('output.mp4')

      // @ffmpeg/core (single-thread) always uses ArrayBuffer internally;
      // the generic param is ArrayBufferLike to cover the -mt variant too.
      const processedBlob = new Blob(
        [
          outputData instanceof Uint8Array
            ? (outputData as Uint8Array<ArrayBuffer>)
            : new TextEncoder().encode(outputData as string),
        ],
        { type: 'video/mp4' },
      )

      // Upload to Supabase Storage using the authenticated browser session.
      setStatus({ type: 'uploading' })
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated.')

      // Path scoped under the user's ID to satisfy Storage RLS policies.
      const storagePath = `${user.id}/${workoutId}/${setId}.mp4`

      const { error: uploadError } = await supabase.storage
        .from('workout-videos')
        .upload(storagePath, processedBlob, { contentType: 'video/mp4', upsert: true })

      if (uploadError) throw new Error(uploadError.message)

      const { data: urlData } = supabase.storage.from('workout-videos').getPublicUrl(storagePath)

      // Persist the video URL via a server action (ownership checked server-side).
      const result = await saveSetVideoUrl({ setId, videoUrl: urlData.publicUrl })
      if (!result.success) throw new Error(result.message)

      // Best-effort: capture mid-frame thumbnail from the branded processed video
      // and upload it so Strava sync can attach it as a photo.
      try {
        const thumbBlob = await captureMiddleFrame(processedBlob)
        const thumbPath = `${user.id}/${workoutId}/${setId}-thumb.jpg`
        const { error: thumbErr } = await supabase.storage
          .from('workout-videos')
          .upload(thumbPath, thumbBlob, { contentType: 'image/jpeg', upsert: true })
        if (!thumbErr) {
          const { data: thumbUrlData } = supabase.storage
            .from('workout-videos')
            .getPublicUrl(thumbPath)
          await saveSetThumbnailUrl({ setId, thumbnailUrl: thumbUrlData.publicUrl })
        }
      } catch {
        // Non-critical — video upload already succeeded
      }

      setStatus({ type: 'done', url: urlData.publicUrl })
      onVideoUrlChange?.(urlData.publicUrl)
    } catch (err) {
      setStatus({ type: 'error', message: err instanceof Error ? err.message : 'Upload failed' })
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) void processAndUpload(file)
    e.target.value = '' // Reset so the same file can be re-selected if needed
  }

  // The hidden file input is always rendered so fileInputRef is always valid,
  // even when the "Replace" button in the done state triggers it.
  const fileInput = (
    <input
      ref={fileInputRef}
      type="file"
      accept="video/*"
      onChange={handleFileChange}
      className="sr-only"
      aria-label={`Upload clip for ${exerciseName} set`}
    />
  )

  // ── done ──────────────────────────────────────────────────────────────────
  if (status.type === 'done') {
    const handleDelete = async () => {
      if (!confirm('Remove this clip? You can upload a new one after.')) return
      setStatus({ type: 'deleting' })
      const result = await deleteSetVideoUrl(setId)
      if (result.success) {
        setStatus({ type: 'idle' })
        onVideoUrlChange?.(null)
      } else {
        setStatus({ type: 'error', message: result.message ?? 'Delete failed.' })
      }
    }

    return (
      <>
        {fileInput}
        <div className="mt-1 flex items-center gap-3">
          {onOpenReel ? (
            <button
              type="button"
              onClick={onOpenReel}
              className="flex items-center gap-1 text-xs text-green-700 hover:text-green-600"
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current" aria-hidden="true">
                <path d="M8 5v14l11-7z" />
              </svg>
              View clip
            </button>
          ) : (
            <a
              href={status.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-green-700 hover:text-green-600"
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current" aria-hidden="true">
                <path d="M8 5v14l11-7z" />
              </svg>
              View clip
            </a>
          )}
          <span className="text-zinc-300">·</span>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="text-xs text-zinc-500 hover:text-zinc-700"
          >
            Replace
          </button>
          <span className="text-zinc-300">·</span>
          <button
            type="button"
            onClick={handleDelete}
            className="text-xs text-rose-400 hover:text-rose-500"
          >
            Delete
          </button>
        </div>
      </>
    )
  }

  // ── deleting ──────────────────────────────────────────────────────────────
  if (status.type === 'deleting') {
    return <span className="mt-1 text-xs text-zinc-400">Removing clip…</span>
  }

  // ── error ─────────────────────────────────────────────────────────────────
  if (status.type === 'error') {
    return (
      <>
        {fileInput}
        <div className="mt-1 space-y-1">
          <p className="text-xs text-rose-400">{status.message}</p>
          <button
            type="button"
            onClick={() => setStatus({ type: 'idle' })}
            className="text-xs text-zinc-500 underline hover:text-zinc-300"
          >
            Tap to retry
          </button>
        </div>
      </>
    )
  }

  // ── in-progress ───────────────────────────────────────────────────────────
  if (
    status.type === 'loading-ffmpeg' ||
    status.type === 'processing' ||
    status.type === 'uploading'
  ) {
    const label =
      status.type === 'loading-ffmpeg'
        ? 'Loading…'
        : status.type === 'uploading'
          ? 'Uploading…'
          : `Processing ${status.progress}%`

    const pct = status.type === 'processing' ? status.progress : null

    return (
      <div className="mt-1 flex items-center gap-2">
        <div className="h-1 w-20 overflow-hidden rounded-full bg-zinc-200">
          {pct !== null ? (
            <div
              className="h-full rounded-full bg-green-700 transition-all duration-200"
              style={{ width: `${pct}%` }}
            />
          ) : (
            <div className="h-full w-1/2 animate-pulse rounded-full bg-green-600" />
          )}
        </div>
        <span className="text-xs text-zinc-500">{label}</span>
      </div>
    )
  }

  // ── idle ──────────────────────────────────────────────────────────────────
  return (
    <>
      {fileInput}
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="mt-1 flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-700"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-3.5 w-3.5 fill-none stroke-current stroke-[1.5]"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9A2.25 2.25 0 0013.5 5.25h-9A2.25 2.25 0 002.25 7.5v9A2.25 2.25 0 004.5 18.75z"
          />
        </svg>
        Add clip
      </button>
    </>
  )
}

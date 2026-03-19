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
import { saveSetVideoUrl } from '../actions'

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

const GOLD = '#E8B84B'
const FONT = 'system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif'

/**
 * Renders a full-frame transparent PNG containing:
 *   • LFD gold badge — top-right corner (channel-bug style)
 *   • Info strip      — bottom 120px: exercise name, weight×reps, RPE/1RM badges
 *
 * Using a full-frame canvas (vs a cropped strip) lets the LFD badge live at
 * the real top-right of the video. FFmpeg composites it with overlay=0:0.
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

    // ── LFD brand badge (top-right) ────────────────────────────────────
    // Solid gold rectangle with dark text — unmistakable channel-bug style.
    ctx.font = `900 28px ${FONT}`
    const BADGE_PAD_X = 16
    const BADGE_PAD_Y = 9
    const lfdMetrics = ctx.measureText('LFD')
    const badgeW = lfdMetrics.width + BADGE_PAD_X * 2
    const badgeH = 28 + BADGE_PAD_Y * 2
    const badgeX = W - badgeW - 20
    const badgeY = 20

    ctx.fillStyle = GOLD
    ctx.beginPath()
    ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 5)
    ctx.fill()

    ctx.fillStyle = '#0A0A0A'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('LFD', badgeX + badgeW / 2, badgeY + badgeH / 2)

    // ── Bottom info strip ───────────────────────────────────────────────
    const STRIP_H = 120
    const stripY = H - STRIP_H

    ctx.fillStyle = 'rgba(0,0,0,0.85)'
    ctx.fillRect(0, stripY, W, STRIP_H)

    // Gold accent bar at top edge of strip — visual thread to the badge.
    ctx.fillStyle = GOLD
    ctx.fillRect(0, stripY, W, 4)

    // Exercise name — largest, white, left
    ctx.font = `800 44px ${FONT}`
    ctx.fillStyle = '#FFFFFF'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'
    ctx.fillText(data.exerciseName.toUpperCase(), 26, stripY + 66)

    // Weight × reps — gold, left. Brand color on the key number.
    ctx.font = `500 28px ${FONT}`
    ctx.fillStyle = GOLD
    ctx.textAlign = 'left'
    ctx.fillText(`${data.weight} lbs × ${data.reps} reps`, 26, stripY + 106)

    // ── Stat badges (right side) ────────────────────────────────────────
    // RPE  → filled gold pill (most actionable — effort rating)
    // %1RM → outlined gold pill (contextual — relative intensity)
    const statItems: Array<{ label: string; filled: boolean }> = []
    if (data.rpe !== null) statItems.push({ label: `RPE ${data.rpe}`, filled: true })
    if (data.oneRepMax) {
      statItems.push({
        label: `${Math.round((data.weight / data.oneRepMax) * 100)}% 1RM`,
        filled: false,
      })
    }

    if (statItems.length > 0) {
      const PILL_H = 40
      const PILL_PAD_X = 18
      const PILL_GAP = 10
      const PILL_R = PILL_H / 2
      ctx.font = `700 22px ${FONT}`

      const pillWidths = statItems.map(s => ctx.measureText(s.label).width + PILL_PAD_X * 2)
      const totalPillW = pillWidths.reduce((a, b) => a + b, 0) + PILL_GAP * (statItems.length - 1)

      // Vertically center badges in the lower half of the strip
      const pillCenterY = stripY + STRIP_H / 2 + 16
      let px = W - 26 - totalPillW

      statItems.forEach((stat, i) => {
        const pw = pillWidths[i]
        const py = pillCenterY - PILL_H / 2

        if (stat.filled) {
          ctx.fillStyle = GOLD
          ctx.beginPath()
          ctx.roundRect(px, py, pw, PILL_H, PILL_R)
          ctx.fill()
          ctx.fillStyle = '#0A0A0A'
        } else {
          ctx.strokeStyle = GOLD
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.roundRect(px + 1, py + 1, pw - 2, PILL_H - 2, PILL_R)
          ctx.stroke()
          ctx.fillStyle = GOLD
        }

        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(stat.label, px + pw / 2, pillCenterY)
        px += pw + PILL_GAP
      })
    }

    canvas.toBlob((blob) => {
      if (!blob) { reject(new Error('Canvas toBlob failed')); return }
      blob.arrayBuffer().then(
        (buf) => resolve(new Uint8Array(buf) as Uint8Array<ArrayBuffer>),
        reject,
      )
    }, 'image/png')
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
}

type Status =
  | { type: 'idle' }
  | { type: 'loading-ffmpeg' }
  | { type: 'processing'; progress: number }
  | { type: 'uploading' }
  | { type: 'done'; url: string }
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

      // Persist the URL via a server action (ownership checked server-side).
      const result = await saveSetVideoUrl({ setId, videoUrl: urlData.publicUrl })
      if (!result.success) throw new Error(result.message)

      setStatus({ type: 'done', url: urlData.publicUrl })
    } catch (err) {
      setStatus({ type: 'error', message: err instanceof Error ? err.message : 'Upload failed' })
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) void processAndUpload(file)
    e.target.value = '' // Reset so the same file can be re-selected if needed
  }

  // ── done ──────────────────────────────────────────────────────────────────
  if (status.type === 'done') {
    return (
      <a
        href={status.url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-1 flex w-fit items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
      >
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current" aria-hidden="true">
          <path d="M8 5v14l11-7z" />
        </svg>
        View clip
      </a>
    )
  }

  // ── error ─────────────────────────────────────────────────────────────────
  if (status.type === 'error') {
    return (
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
        <div className="h-1 w-20 overflow-hidden rounded-full bg-zinc-800">
          {pct !== null ? (
            <div
              className="h-full rounded-full bg-blue-500 transition-all duration-200"
              style={{ width: `${pct}%` }}
            />
          ) : (
            <div className="h-full w-1/2 animate-pulse rounded-full bg-indigo-500" />
          )}
        </div>
        <span className="text-xs text-zinc-500">{label}</span>
      </div>
    )
  }

  // ── idle ──────────────────────────────────────────────────────────────────
  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        capture="environment"
        onChange={handleFileChange}
        className="sr-only"
        aria-label={`Upload clip for ${exerciseName} set`}
      />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="mt-1 flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300"
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

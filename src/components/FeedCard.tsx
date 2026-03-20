'use client'

import type { FeedItem, MediaItem } from '@/lib/feed'
import Link from 'next/link'
import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { nameToSlug } from '@/lib/lifts'
import JorkButton from './JorkButton'
import CommentsSection from './CommentsSection'
import WorkoutVideoReelModal from './WorkoutVideoReelModal'

// ── Brand mark ─────────────────────────────────────────────────────────────

function BrandMark({ size = 26 }: { size?: number }) {
  return (
    <div
      className="shrink-0 flex items-center justify-center text-[9px] font-black tracking-widest text-white"
      style={{ width: size, height: size, background: 'linear-gradient(135deg, #166534, #16a34a)' }}
      aria-label="LFD"
    >
      LFD
    </div>
  )
}

// ── VideoSlide ─────────────────────────────────────────────────────────────

function VideoSlide({ url, label, onOpen }: { url: string; label: string; onOpen: () => void }) {
  const [aspectRatio, setAspectRatio] = useState('4/5')

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="Open video reel"
      className="relative block w-full overflow-hidden"
      style={{ aspectRatio }}
    >
      <video
        src={url}
        className="h-full w-full object-cover"
        preload="metadata"
        muted
        playsInline
        onLoadedMetadata={(e) => {
          const v = e.currentTarget
          v.currentTime = 0.001
          if (v.videoWidth && v.videoHeight) {
            setAspectRatio(`${v.videoWidth}/${v.videoHeight}`)
          }
        }}
      />

      <div className="absolute inset-0 flex flex-col pointer-events-none">
        <p className="m-3 self-start rounded bg-black/50 px-2.5 py-1 text-[11px] font-semibold leading-none text-white backdrop-blur-sm">
          {label}
        </p>
        <div className="flex flex-1 items-center justify-center">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-full shadow-xl shadow-black/50"
            style={{ background: 'linear-gradient(135deg, #166534, #16a34a)' }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="ml-1 h-7 w-7 text-white" aria-hidden="true">
              <path d="M8 5.5v13l10-6.5L8 5.5z" />
            </svg>
          </div>
        </div>
      </div>
    </button>
  )
}

// ── PhotoSlide ─────────────────────────────────────────────────────────────

function PhotoSlide({ url }: { url: string }) {
  return (
    <div className="w-full bg-zinc-100" style={{ aspectRatio: '4/3' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="Post photo" className="h-full w-full object-cover" />
    </div>
  )
}

// ── MediaCarousel ──────────────────────────────────────────────────────────

function MediaCarousel({ items, onOpenVideo }: { items: MediaItem[]; onOpenVideo: (videoUrl: string) => void }) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [activeIndex, setActiveIndex] = useState(0)

  const onScroll = () => {
    if (!scrollRef.current) return
    const idx = Math.round(scrollRef.current.scrollLeft / scrollRef.current.clientWidth)
    setActiveIndex(idx)
  }

  return (
    <div>
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="flex overflow-x-auto"
        style={{ scrollSnapType: 'x mandatory', scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {items.map((item, i) => (
          <div key={i} style={{ scrollSnapAlign: 'start', flexShrink: 0, width: '100%' }}>
            {item.kind === 'video'
              ? <VideoSlide url={item.url} label={item.label} onOpen={() => onOpenVideo(item.url)} />
              : <PhotoSlide url={item.url} />}
          </div>
        ))}
      </div>
      {items.length > 1 && (
        <div className="flex justify-center gap-1.5 py-2">
          {items.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-200 ${
                i === activeIndex ? 'w-4 bg-green-700' : 'w-1.5 bg-zinc-200'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── FeedCard ───────────────────────────────────────────────────────────────

type Props = {
  item: FeedItem
  displayName: string
  userInitial: string
  username?: string | null
  avatarUrl?: string | null
  // Social
  jorkCount?: number
  commentCount?: number
  hasJorked?: boolean
  currentUserId?: string
}

export default function FeedCard({ item, displayName, userInitial, username, avatarUrl, jorkCount = 0, commentCount = 0, hasJorked = false, currentUserId }: Props) {
  const { workout, topSetsByExercise, mediaItems, extraBadges } = item
  const router = useRouter()
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [localCommentCount, setLocalCommentCount] = useState(commentCount)
  const [reelStartIndex, setReelStartIndex] = useState<number | null>(null)

  const sets = workout.sets ?? []
  const orderedSets = useMemo(() => {
    return [...sets].sort((a, b) => {
      const ta = a.created_at ? new Date(a.created_at).getTime() : 0
      const tb = b.created_at ? new Date(b.created_at).getTime() : 0
      if (ta !== tb) return ta - tb
      return a.id.localeCompare(b.id)
    })
  }, [sets])

  const videoReelClips = useMemo(() => {
    const countByExercise: Record<string, number> = {}
    const clips: Array<{ id: string; src: string; title: string; subtitle: string }> = []

    for (const set of orderedSets) {
      if (!set.video_url) continue
      countByExercise[set.exercise_name] = (countByExercise[set.exercise_name] ?? 0) + 1
      const setNum = countByExercise[set.exercise_name]
      clips.push({
        id: set.id,
        src: set.video_url,
        title: `${set.exercise_name} · Set ${setNum}`,
        subtitle: `${set.weight} lbs × ${set.reps}${set.rpe != null ? ` · RPE ${set.rpe}` : ''}`,
      })
    }

    return clips
  }, [orderedSets])

  const dateStr = new Date(workout.created_at).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })

  const summaryHref = `/workout/${workout.id}/summary`
  const profileHref = username ? `/people/${username}` : null

  const exerciseCount = new Set(sets.map((s) => s.exercise_name)).size
  const totalVolume = sets.reduce((sum, s) => sum + s.weight * s.reps, 0)
  const workoutTitle = workout.name?.trim() || null
  const primaryLift = topSetsByExercise[0] ?? null

  const avatarContent = avatarUrl
    // eslint-disable-next-line @next/next/no-img-element
    ? <img src={avatarUrl} alt={displayName} className="h-full w-full object-cover" />
    : userInitial

  return (
    <article className="overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-sm">

      {/* ── Card header ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-3">
        {profileHref ? (
          <Link
            href={profileHref}
            className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-bold text-white hover:opacity-80 transition-opacity"
            style={{ background: 'linear-gradient(135deg, #166534, #16a34a)' }}
          >
            {avatarContent}
          </Link>
        ) : (
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-bold text-white"
            style={{ background: 'linear-gradient(135deg, #166534, #16a34a)' }}
          >
            {avatarContent}
          </div>
        )}

        <Link href={summaryHref} className="flex min-w-0 flex-1 items-center gap-2 hover:opacity-70 transition-opacity">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-zinc-900">{displayName}</p>
            <p className="text-xs text-zinc-400">
              {dateStr}{workoutTitle ? <> · <span className="text-zinc-500">{workoutTitle}</span></> : null}
            </p>
          </div>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0 text-zinc-300" aria-hidden="true">
            <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
          </svg>
        </Link>
      </div>

      {/* ── Media carousel ───────────────────────────────────────────────── */}
      {mediaItems.length > 0 && (
        <MediaCarousel
          items={mediaItems}
          onOpenVideo={(videoUrl) => {
            const idx = videoReelClips.findIndex((clip) => clip.src === videoUrl)
            setReelStartIndex(idx >= 0 ? idx : 0)
          }}
        />
      )}

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <div
        role="link"
        tabIndex={0}
        onClick={() => router.push(summaryHref)}
        onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && router.push(summaryHref)}
        className="cursor-pointer px-4 py-3 hover:bg-zinc-50 transition-colors"
      >
        {/* Surface primary lift only when there's no media to carry the context */}
        {mediaItems.length === 0 && primaryLift && (
          <div className="mb-2 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <Link
                href={`/lifts/${nameToSlug(primaryLift.set.exercise_name)}`}
                onClick={e => e.stopPropagation()}
                className="block truncate text-sm font-bold uppercase tracking-wide text-zinc-900 hover:text-green-700 transition-colors"
              >
                {primaryLift.set.exercise_name}
              </Link>
              <p className="text-xs text-zinc-500">{primaryLift.set.weight} lbs × {primaryLift.set.reps} reps</p>
            </div>
            <div className="flex shrink-0 flex-wrap justify-end gap-1.5 pt-0.5">
              {extraBadges.map(badge => (
                <span
                  key={badge}
                  className="rounded-full px-2.5 py-0.5 text-xs font-bold text-white"
                  style={{ background: 'linear-gradient(135deg, #166534, #16a34a)' }}
                >
                  {badge}
                </span>
              ))}
              {primaryLift.set.rpe !== null && (
                <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-semibold text-zinc-600">
                  RPE {primaryLift.set.rpe}
                </span>
              )}
              {primaryLift.pctOneRepMax !== null && (
                <span className="rounded-full border border-green-700 px-2.5 py-0.5 text-xs font-semibold text-green-700">
                  {primaryLift.pctOneRepMax}% 1RM
                </span>
              )}
            </div>
          </div>
        )}

        <p className="text-xs text-zinc-400">
          {exerciseCount} {exerciseCount === 1 ? 'exercise' : 'exercises'}
          {' · '}{sets.length} {sets.length === 1 ? 'set' : 'sets'}
          {' · '}{totalVolume.toLocaleString()} lbs total
        </p>
      </div>

      {/* ── Action bar ───────────────────────────────────────────────────── */}
      {currentUserId && (
        <div
          className="flex items-center border-t border-zinc-50 px-3 py-1"
          onClick={e => e.stopPropagation()}
        >
          <JorkButton
            workoutId={workout.id}
            workoutOwnerId={workout.user_id}
            initialCount={jorkCount}
            initialHasJorked={hasJorked}
          />
          <button
            type="button"
            onClick={() => setCommentsOpen(o => !o)}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-semibold transition-colors ${
              commentsOpen ? 'text-green-700' : 'text-zinc-400 hover:bg-zinc-50 hover:text-zinc-600'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
              <path fillRule="evenodd" d="M10 2c-2.236 0-4.43.18-6.57.524C1.993 2.755 1 4.014 1 5.426v5.148c0 1.413.993 2.67 2.43 2.902.848.137 1.705.248 2.57.331v3.443a.75.75 0 001.28.53l3.58-3.579a.78.78 0 01.527-.224 41.202 41.202 0 005.183-.5c1.437-.232 2.43-1.49 2.43-2.903V5.426c0-1.413-.993-2.67-2.43-2.902A41.289 41.289 0 0010 2zm0 7a1 1 0 100-2 1 1 0 000 2zM7 9a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" clipRule="evenodd" />
            </svg>
            {localCommentCount > 0 && <span className="tabular-nums leading-none">{localCommentCount}</span>}
            <span className="sr-only">Comments</span>
          </button>
        </div>
      )}

      {/* ── Inline comments ──────────────────────────────────────────────── */}
      {commentsOpen && currentUserId && (
        <CommentsSection
          workoutId={workout.id}
          workoutOwnerId={workout.user_id}
          onNewComment={() => setLocalCommentCount(c => c + 1)}
        />
      )}

      {reelStartIndex !== null && videoReelClips.length > 0 && (
        <WorkoutVideoReelModal
          clips={videoReelClips}
          initialIndex={reelStartIndex}
          onClose={() => setReelStartIndex(null)}
        />
      )}

    </article>
  )
}


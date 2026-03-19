'use client'

import type { FeedItem, MediaItem } from '@/lib/feed'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { nameToSlug } from '@/lib/lifts'

// ── VideoSlide ─────────────────────────────────────────────────────────────

function VideoSlide({ url, label, isActive }: { url: string; label: string; isActive: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    if (!isActive && videoRef.current && !videoRef.current.paused) {
      videoRef.current.pause()
      setPlaying(false)
    }
  }, [isActive])

  const toggle = (e: React.MouseEvent) => {
    e.preventDefault()
    if (!videoRef.current) return
    if (playing) {
      videoRef.current.pause()
      setPlaying(false)
    } else {
      videoRef.current.play().catch(() => {})
      setPlaying(true)
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={playing ? 'Pause video' : 'Play video'}
      className="relative block w-full bg-black"
      style={{ aspectRatio: '9/16', maxHeight: 480 }}
    >
      <video
        ref={videoRef}
        src={url}
        className="h-full w-full object-contain"
        preload="metadata"
        loop
        playsInline
        onLoadedMetadata={() => {
          if (videoRef.current) videoRef.current.currentTime = 0.001
        }}
        onEnded={() => setPlaying(false)}
      />
      {!playing && (
        <div className="absolute inset-0 flex flex-col justify-between p-3">
          <p className="self-start rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-semibold leading-none text-white">
            {label}
          </p>
          <div className="flex items-center justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-500 shadow-xl shadow-black/40">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="ml-1 h-7 w-7 text-black" aria-hidden="true">
                <path d="M8 5.5v13l10-6.5L8 5.5z" />
              </svg>
            </div>
          </div>
          <div />
        </div>
      )}
    </button>
  )
}

// ── PhotoSlide ─────────────────────────────────────────────────────────────

function PhotoSlide({ url }: { url: string }) {
  return (
    <div className="w-full bg-zinc-900" style={{ aspectRatio: '4/3' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="Post photo" className="h-full w-full object-cover" />
    </div>
  )
}

// ── MediaCarousel ──────────────────────────────────────────────────────────

function MediaCarousel({ items }: { items: MediaItem[] }) {
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
            {item.kind === 'video' ? (
              <VideoSlide url={item.url} label={item.label} isActive={i === activeIndex} />
            ) : (
              <PhotoSlide url={item.url} />
            )}
          </div>
        ))}
      </div>
      {items.length > 1 && (
        <div className="flex justify-center gap-1.5 py-2.5">
          {items.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-200 ${
                i === activeIndex ? 'w-5 bg-amber-500' : 'w-1.5 bg-zinc-600'
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
}

export default function FeedCard({ item, displayName, userInitial, username, avatarUrl }: Props) {
  const { workout, topSetsByExercise, mediaItems, extraBadges } = item
  const router = useRouter()

  const dateStr = new Date(workout.created_at).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })

  const summaryHref = `/workout/${workout.id}/summary`
  const profileHref = username ? `/people/${username}` : null

  // Workout-level aggregate stats computed from all sets
  const sets = workout.sets ?? []
  const exerciseCount = new Set(sets.map((s) => s.exercise_name)).size
  const totalVolume = sets.reduce((sum, s) => sum + s.weight * s.reps, 0)
  const workoutTitle = workout.name?.trim() || null

  return (
    <article className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">

      {/* ── Card header ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Avatar — links to profile if username is known */}
        {profileHref ? (
          <Link
            href={profileHref}
            className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-amber-500 text-sm font-bold text-black hover:opacity-80 transition-opacity"
          >
            {avatarUrl
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={avatarUrl} alt={displayName} className="h-full w-full object-cover" />
              : userInitial}
          </Link>
        ) : (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-amber-500 text-sm font-bold text-black">
            {avatarUrl
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={avatarUrl} alt={displayName} className="h-full w-full object-cover" />
              : userInitial}
          </div>
        )}

        {/* Name + date — links to workout summary */}
        <Link href={summaryHref} className="flex min-w-0 flex-1 items-center gap-2 hover:opacity-80 transition-opacity">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{displayName}</p>
            <p className="text-xs text-zinc-500">
              {dateStr}{workoutTitle ? <> · <span className="text-zinc-400">{workoutTitle}</span></> : null}
            </p>
          </div>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0 text-zinc-600" aria-hidden="true">
            <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
          </svg>
        </Link>
      </div>

      {/* ── Media carousel ───────────────────────────────────────────────── */}
      {mediaItems.length > 0 && <MediaCarousel items={mediaItems} />}

      {/* ── Lift section ─────────────────────────────────────────────────── */}
      <div
        role="link"
        tabIndex={0}
        onClick={() => router.push(summaryHref)}
        onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && router.push(summaryHref)}
        className="block cursor-pointer px-4 py-3 hover:bg-zinc-800/40 transition-colors"
      >
        <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-amber-500">
          Top Lift{topSetsByExercise.length > 1 ? 's' : ''}
        </p>

        <div className="space-y-2">
          {topSetsByExercise.slice(0, 3).map(({ set, pctOneRepMax }, idx) => (
            <div key={set.id} className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link
                  href={`/lifts/${nameToSlug(set.exercise_name)}`}
                  onClick={e => e.stopPropagation()}
                  className={`block truncate font-extrabold uppercase tracking-wide text-white hover:text-amber-400 transition-colors ${idx === 0 ? 'text-base' : 'text-sm'}`}
                >
                  {set.exercise_name}
                </Link>
                <p className={`mt-0.5 text-zinc-400 ${idx === 0 ? 'text-sm' : 'text-xs'}`}>
                  {set.weight} lbs × {set.reps} reps
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap justify-end gap-1.5 pt-0.5">
                {idx === 0 && extraBadges.map(badge => (
                  <span key={badge} className="rounded-full bg-amber-500 px-2.5 py-0.5 text-xs font-bold text-black">
                    {badge}
                  </span>
                ))}
                {set.rpe !== null && (
                  <span className="rounded-full bg-zinc-700 px-2.5 py-0.5 text-xs font-semibold text-white">
                    RPE {set.rpe}
                  </span>
                )}
                {pctOneRepMax !== null && (
                  <span className="rounded-full border border-amber-500 px-2.5 py-0.5 text-xs font-semibold text-amber-400">
                    {pctOneRepMax}% 1RM
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {topSetsByExercise.length > 3 && (
          <p className="mt-1.5 text-xs text-zinc-500">+{topSetsByExercise.length - 3} more exercises</p>
        )}

        <p className="mt-2.5 text-xs text-zinc-500">
          {exerciseCount} {exerciseCount === 1 ? 'exercise' : 'exercises'}
          {' · '}{sets.length} {sets.length === 1 ? 'set' : 'sets'}
          {' · '}{totalVolume.toLocaleString()} lbs total
        </p>
      </div>
    </article>
  )
}

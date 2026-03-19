'use client'

import type { FeedItem } from '@/lib/feed'
import Link from 'next/link'
import { useRef, useState } from 'react'

type Props = {
  item: FeedItem
  displayName: string
  userInitial: string
}

export default function FeedCard({ item, displayName, userInitial }: Props) {
  const { workout, highlightSet, pctOneRepMax, extraBadges } = item
  const videoRef = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)

  const dateStr = new Date(workout.created_at).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })

  const workoutTitle = workout.name?.trim() || highlightSet.exercise_name

  const togglePlay = () => {
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
    <article className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">

      {/* ── Card header ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Avatar */}
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-500 text-sm font-bold text-black">
          {userInitial}
        </div>

        {/* Name + date */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{displayName}</p>
          <p className="text-xs text-zinc-500">{dateStr}</p>
        </div>

        {/* Workout link */}
        <Link
          href={`/workout/${workout.id}/summary`}
          className="shrink-0 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          {workoutTitle}
        </Link>
      </div>

      {/* ── Video (if present) ───────────────────────────────────────── */}
      {highlightSet.video_url && (
        <button
          type="button"
          onClick={togglePlay}
          aria-label={playing ? 'Pause video' : 'Play video'}
          className="relative block w-full bg-black"
          style={{ aspectRatio: '9/16', maxHeight: 520 }}
        >
          <video
            ref={videoRef}
            src={highlightSet.video_url}
            className="h-full w-full object-contain"
            preload="metadata"
            loop
            playsInline
            onEnded={() => setPlaying(false)}
          />

          {/* Play overlay — hides once playing */}
          {!playing && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/25">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-500 shadow-xl shadow-black/40">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="ml-1 h-8 w-8 text-black"
                  aria-hidden="true"
                >
                  <path d="M8 5.5v13l10-6.5L8 5.5z" />
                </svg>
              </div>
            </div>
          )}
        </button>
      )}

      {/* ── Lift info + badges ───────────────────────────────────────── */}
      <div className="px-4 py-3">
        <div className="flex items-start justify-between gap-3">

          {/* Primary lift data */}
          <div className="min-w-0">
            <p className="truncate text-base font-extrabold uppercase tracking-wide text-white">
              {highlightSet.exercise_name}
            </p>
            <p className="mt-0.5 text-sm text-zinc-400">
              {highlightSet.weight} lbs × {highlightSet.reps} reps
            </p>
          </div>

          {/* Badges */}
          <div className="flex shrink-0 flex-wrap justify-end gap-1.5 pt-0.5">
            {/* Extra badges (PR, KOL, etc.) — extensible */}
            {extraBadges.map((badge) => (
              <span
                key={badge}
                className="rounded-full bg-amber-500 px-2.5 py-0.5 text-xs font-bold text-black"
              >
                {badge}
              </span>
            ))}

            {/* RPE — filled amber pill: the prescribed effort */}
            {highlightSet.rpe !== null && (
              <span className="rounded-full bg-zinc-700 px-2.5 py-0.5 text-xs font-semibold text-white">
                RPE {highlightSet.rpe}
              </span>
            )}

            {/* %1RM — outlined amber pill: relative intensity */}
            {pctOneRepMax !== null && (
              <span className="rounded-full border border-amber-500 px-2.5 py-0.5 text-xs font-semibold text-amber-400">
                {pctOneRepMax}% 1RM
              </span>
            )}
          </div>
        </div>
      </div>
    </article>
  )
}

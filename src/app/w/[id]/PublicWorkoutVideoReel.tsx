'use client'

import { useMemo, useState } from 'react'
import WorkoutVideoReelModal from '@/components/WorkoutVideoReelModal'

type Clip = {
  id: string
  exercise_name: string
  weight: number
  reps: number
  rpe: number | null
  video_url: string
}

type Props = {
  clips: Clip[]
}

export default function PublicWorkoutVideoReel({ clips }: Props) {
  const [reelStartIndex, setReelStartIndex] = useState<number | null>(null)

  const reelClips = useMemo(() => (
    clips.map((clip, i) => ({
      id: clip.id,
      src: clip.video_url,
      title: `${clip.exercise_name} · Clip ${i + 1}`,
      subtitle: `${clip.weight} lbs × ${clip.reps}${clip.rpe != null ? ` · RPE ${clip.rpe}` : ''}`,
    }))
  ), [clips])

  const hero = clips[0]

  const openAtSet = (setId: string) => {
    const idx = reelClips.findIndex((clip) => clip.id === setId)
    if (idx >= 0) setReelStartIndex(idx)
  }

  return (
    <>
      <button type="button" onClick={() => setReelStartIndex(0)} className="relative block w-full bg-black text-left">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          src={hero.video_url}
          playsInline
          autoPlay
          muted
          loop
          className="block w-full"
          style={{ maxHeight: '85dvh', objectFit: 'contain' }}
        />

        <div className="pointer-events-none absolute bottom-4 left-4 flex max-w-[85%] items-center gap-2">
          <div className="rounded-xl bg-black/55 px-3 py-1.5 text-sm font-semibold text-white backdrop-blur-sm">
            {hero.exercise_name} — {hero.weight} lbs × {hero.reps}
            {hero.rpe != null && <span className="ml-1.5 text-white/70">RPE {hero.rpe}</span>}
          </div>
          {reelClips.length > 1 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[11px] font-semibold text-zinc-900">
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current" aria-hidden="true">
                <path d="M8 5v14l11-7z" />
              </svg>
              Open reel
            </span>
          )}
        </div>
      </button>

      {reelClips.length > 1 && (
        <div className="mt-4 rounded-xl border border-zinc-100 bg-white p-3 shadow-sm">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">All clips</p>
          <div className="flex gap-2 overflow-x-auto">
            {clips.map((clip, i) => (
              <button
                key={clip.id}
                type="button"
                onClick={() => openAtSet(clip.id)}
                className="min-w-[180px] rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2 text-left"
              >
                <p className="truncate text-xs font-semibold text-zinc-900">{clip.exercise_name}</p>
                <p className="mt-0.5 text-[11px] text-zinc-500">Clip {i + 1} · {clip.weight} lbs × {clip.reps}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {reelStartIndex !== null && reelClips.length > 0 && (
        <WorkoutVideoReelModal
          clips={reelClips}
          initialIndex={reelStartIndex}
          onClose={() => setReelStartIndex(null)}
        />
      )}
    </>
  )
}

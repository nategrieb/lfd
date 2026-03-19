'use client'

import { useState } from 'react'
import VideoModal from '@/components/VideoModal'

export type SummarySet = {
  id: string
  exercise_name: string
  weight: number
  reps: number
  rpe: number | null
  video_url: string | null
  created_at: string
}

type Props = {
  grouped: Record<string, SummarySet[]>
  prBadges: Record<string, boolean>
}

export default function SummarySetsSection({ grouped, prBadges }: Props) {
  const [activeVideo, setActiveVideo] = useState<{ src: string; title: string } | null>(null)

  return (
    <>
      {Object.entries(grouped).map(([exercise, sets]) => (
        <div key={exercise} className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-base font-bold">{exercise}</h2>
            {prBadges[exercise] && (
              <span className="inline-flex items-center gap-1 rounded bg-amber-500/20 px-2 py-0.5 text-xs font-bold text-amber-300">
                🔥 NEW PR
              </span>
            )}
          </div>

          <ul className="space-y-2">
            {sets.map((set, i) => (
              <li
                key={set.id}
                className="flex items-center gap-2 rounded-lg bg-zinc-950/40 px-3 py-2 text-sm"
              >
                {/* Set number */}
                <span className="w-10 shrink-0 text-zinc-500">Set {i + 1}</span>

                {/* Weight × reps */}
                <span className="flex-1">
                  {set.weight} lbs × {set.reps}
                  {set.rpe !== null && (
                    <span className="ml-2 text-xs text-zinc-500">RPE {set.rpe}</span>
                  )}
                </span>

                {/* Video indicator + play button */}
                {set.video_url ? (
                  <button
                    type="button"
                    onClick={() =>
                      setActiveVideo({
                        src: set.video_url!,
                        title: `${exercise} — Set ${i + 1} · ${set.weight} lbs × ${set.reps}`,
                      })
                    }
                    aria-label={`Play video for ${exercise} set ${i + 1}`}
                    className="flex shrink-0 items-center gap-1.5 rounded-lg bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-400 transition hover:bg-amber-500/25"
                  >
                    {/* Play icon */}
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      className="h-3.5 w-3.5"
                      aria-hidden="true"
                    >
                      <path d="M6.3 2.841A1.5 1.5 0 004 4.11v11.78a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                    </svg>
                    Clip
                  </button>
                ) : (
                  /* Placeholder keeps layout stable for rows without video */
                  <span className="w-[58px] shrink-0" aria-hidden="true" />
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}

      {activeVideo && (
        <VideoModal
          src={activeVideo.src}
          title={activeVideo.title}
          onClose={() => setActiveVideo(null)}
        />
      )}
    </>
  )
}

'use client'

import { useState } from 'react'
import WorkoutVideoReelModal from '@/components/WorkoutVideoReelModal'

export type VideoClip = {
  src: string
  thumbnail?: string | null
  title: string
  date: string
}

export default function LiftVideoSection({ clips }: { clips: VideoClip[] }) {
  const [reelStartIndex, setReelStartIndex] = useState<number | null>(null)

  if (clips.length === 0) return null

  return (
    <section className="mb-6">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
        Videos · {clips.length}
      </h2>
      <div className="grid grid-cols-2 gap-3">
        {clips.map((clip, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setReelStartIndex(i)}
            className="group overflow-hidden rounded-xl border border-zinc-100 bg-white shadow-sm text-left transition hover:border-green-700/30"
          >
            {/* Thumbnail: saved frame if there is one, else the video's first frame. Play button on top. */}
            <div className="relative flex aspect-video items-center justify-center overflow-hidden bg-zinc-100">
              {clip.thumbnail ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={clip.thumbnail} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
              ) : (
                <video
                  src={`${clip.src}#t=0.1`}
                  preload="metadata"
                  muted
                  playsInline
                  aria-hidden="true"
                  tabIndex={-1}
                  className="pointer-events-none absolute inset-0 h-full w-full object-cover"
                />
              )}
              <span className="relative flex h-10 w-10 items-center justify-center rounded-full bg-green-50/90 transition group-hover:bg-green-100" style={{ boxShadow: '0 0 0 1px #16653420' }}>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="h-5 w-5 text-green-700"
                  aria-hidden="true"
                >
                  <path d="M8 5v14l11-7z" />
                </svg>
              </span>
            </div>
            <div className="px-3 py-2">
              <p className="truncate text-xs font-semibold text-zinc-900">{clip.title}</p>
              <p className="text-[10px] text-zinc-500">{clip.date}</p>
            </div>
          </button>
        ))}
      </div>

      {reelStartIndex !== null && (
        <WorkoutVideoReelModal
          clips={clips.map((clip) => ({
            id: `${clip.src}-${clip.date}`,
            src: clip.src,
            title: clip.title,
            subtitle: clip.date,
          }))}
          initialIndex={reelStartIndex}
          onClose={() => setReelStartIndex(null)}
        />
      )}
    </section>
  )
}

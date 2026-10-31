'use client'

import { useState, useSyncExternalStore } from 'react'
import WorkoutVideoReelModal from '@/components/WorkoutVideoReelModal'

export type VideoClip = {
  src: string
  thumbnail?: string | null
  title: string
  date: string
  weight: number
  reps: number
}

type VideoSort = 'recent' | 'heaviest'

const SORT_KEY = 'lfd.liftVideoSort'
const SORT_EVENT = 'lfd-video-sort'
const INITIAL_VISIBLE = 2
const STEP = 6

// Preference lives in localStorage; useSyncExternalStore keeps server and first client render
// identical ('recent') and then switches to the saved value without a hydration mismatch.
function subscribeSort(callback: () => void) {
  window.addEventListener('storage', callback)
  window.addEventListener(SORT_EVENT, callback)
  return () => {
    window.removeEventListener('storage', callback)
    window.removeEventListener(SORT_EVENT, callback)
  }
}
const getSort = (): VideoSort => (localStorage.getItem(SORT_KEY) === 'heaviest' ? 'heaviest' : 'recent')
const getServerSort = (): VideoSort => 'recent'

function setSort(sort: VideoSort) {
  localStorage.setItem(SORT_KEY, sort)
  window.dispatchEvent(new Event(SORT_EVENT))
}

/** `clips` arrive newest first. Heaviest = most weight, then most reps, then newest. */
function orderClips(clips: VideoClip[], sort: VideoSort): VideoClip[] {
  if (sort === 'recent') return clips
  return clips
    .map((clip, index) => ({ clip, index }))
    .sort((a, b) => b.clip.weight - a.clip.weight || b.clip.reps - a.clip.reps || a.index - b.index)
    .map(({ clip }) => clip)
}

export default function LiftVideoSection({ clips }: { clips: VideoClip[] }) {
  const [reelStartIndex, setReelStartIndex] = useState<number | null>(null)
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE)
  const sort = useSyncExternalStore(subscribeSort, getSort, getServerSort)

  if (clips.length === 0) return null

  const ordered = orderClips(clips, sort)
  const visible = ordered.slice(0, visibleCount)
  const hiddenCount = ordered.length - visible.length

  return (
    <section className="mb-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Videos · {clips.length}
        </h2>
        {clips.length > 1 && (
          <div className="flex rounded-full border border-zinc-200 p-0.5 text-[11px] font-semibold" role="group" aria-label="Video order">
            {(['recent', 'heaviest'] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => {
                  setSort(option)
                  setVisibleCount(INITIAL_VISIBLE)
                }}
                aria-pressed={sort === option}
                className={`rounded-full px-2.5 py-1 capitalize transition-colors ${
                  sort === option ? 'bg-green-700 text-white' : 'text-zinc-500 hover:text-zinc-800'
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {visible.map((clip, i) => (
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

      {(hiddenCount > 0 || visibleCount > INITIAL_VISIBLE) && (
        <div className="mt-3 flex gap-2">
          {hiddenCount > 0 && (
            <button
              type="button"
              onClick={() => setVisibleCount((n) => n + STEP)}
              className="flex-1 rounded-xl border border-zinc-200 bg-white py-2.5 text-sm font-semibold text-zinc-600 transition-colors hover:bg-zinc-50"
            >
              Show {Math.min(STEP, hiddenCount)} more · {hiddenCount} more video{hiddenCount !== 1 ? 's' : ''}
            </button>
          )}
          {visibleCount > INITIAL_VISIBLE && (
            <button
              type="button"
              onClick={() => setVisibleCount(INITIAL_VISIBLE)}
              className="rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-500 transition-colors hover:bg-zinc-50"
            >
              Show less
            </button>
          )}
        </div>
      )}

      {reelStartIndex !== null && (
        <WorkoutVideoReelModal
          clips={ordered.map((clip) => ({
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

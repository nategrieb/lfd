'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { skipRotation, startRotationWorkout } from './actions'
import { ROTATION, type RotationType } from '@/lib/ppl'
import { TYPE_PILL } from '@/lib/workout-types'

/** Push / Pull / Legs: what is next, a draft to start from your last one, and Skip to move on. */
export default function RotationCard({ next, skipTo, hint, recency }: { next: RotationType; skipTo: RotationType; hint: string | null; recency: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // Same as last time (a draft copied from your last one of this type), or a blank slate with just the type set.
  const start = (blank: boolean) =>
    startTransition(async () => {
      setError(null)
      const result = await startRotationWorkout(next, blank)
      if (result.id) router.push(`/workout/${result.id}`)
      else setError(result.error ?? 'Could not start.')
    })

  return (
    <div className="rounded-3xl border border-zinc-100 bg-white px-6 py-6 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Next up</p>
      <div className="mt-1 flex items-center justify-between gap-3">
        <p className="text-3xl font-black tracking-tight text-zinc-900">{next}</p>
        <div className="flex items-center gap-1">
          {ROTATION.map((type) => (
            <span
              key={type}
              className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ring-1 ring-inset ${type === next ? TYPE_PILL[type] : 'bg-white text-zinc-300 ring-zinc-100'}`}
            >
              {type}
            </span>
          ))}
        </div>
      </div>
      <p className="mt-1 text-xs text-zinc-400">{hint ?? `Nothing tagged ${next} yet, so this starts blank.`}</p>
      <p className="mt-0.5 text-xs text-zinc-300">{recency}</p>

      <div className={`mt-4 grid gap-2 ${hint ? 'grid-cols-2' : 'grid-cols-1'}`}>
        <button
          type="button"
          disabled={pending}
          onClick={() => start(false)}
          className="rounded-xl py-3 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-60"
          style={{ background: 'linear-gradient(135deg, #166534, #16a34a)' }}
        >
          {pending ? 'Starting…' : hint ? 'Same as last' : `Start ${next}`}
        </button>
        {hint && (
        <button
          type="button"
          disabled={pending}
          onClick={() => start(true)}
          className="rounded-xl border border-green-700 py-3 text-sm font-bold text-green-800 transition hover:bg-green-50 disabled:opacity-60"
        >
          Blank slate
        </button>
        )}
      </div>
      <div className="mt-2 flex justify-end">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              setError(null)
              const result = await skipRotation()
              if (result.error) setError(result.error)
              else router.refresh()
            })
          }
          className="rounded-lg px-2 py-1 text-xs font-semibold text-zinc-400 transition hover:text-zinc-700 disabled:opacity-60"
        >
          Skip to {skipTo}
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-rose-500">{error}</p>}
    </div>
  )
}

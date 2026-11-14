'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { startRotationWorkout } from './actions'
import { ROTATION, type RotationType } from '@/lib/ppl'
import { TYPE_PILL } from '@/lib/workout-types'

export type RotationOption = { hint: string | null; recency: string }

/** Push / Pull / Legs: the suggested one is selected; tap another to choose it. Start copies your last one. */
export default function RotationCard({ suggested, options }: { suggested: RotationType; options: Record<RotationType, RotationOption> }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [chosen, setChosen] = useState<RotationType>(suggested)
  const [error, setError] = useState<string | null>(null)
  const option = options[chosen]

  return (
    <div className="rounded-3xl border border-zinc-100 bg-white px-6 py-6 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Push · Pull · Legs</p>

      <div className="mt-3 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Which workout">
        {ROTATION.map((type) => {
          const on = type === chosen
          return (
            <button
              key={type}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setChosen(type)}
              className={`relative rounded-2xl px-2 py-3 text-base font-extrabold ring-1 ring-inset transition-colors ${on ? TYPE_PILL[type] : 'bg-white text-zinc-400 ring-zinc-200'}`}
            >
              {type}
              {type === suggested && <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-zinc-900 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">Next</span>}
            </button>
          )
        })}
      </div>

      <p className="mt-4 text-xs text-zinc-500">{option.hint ?? `You haven’t logged a ${chosen} yet, so this starts empty.`}</p>
      <p className="mt-0.5 text-xs text-zinc-300">{option.recency}</p>

      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null)
            const result = await startRotationWorkout(chosen)
            if (result.id) router.push(`/workout/${result.id}`)
            else setError(result.error ?? 'Could not start.')
          })
        }
        className="mt-4 w-full rounded-xl py-3 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-60"
        style={{ background: 'linear-gradient(135deg, #166534, #16a34a)' }}
      >
        {pending ? 'Starting…' : `Start ${chosen}`}
      </button>
      {error && <p className="mt-2 text-xs text-rose-500">{error}</p>}
    </div>
  )
}

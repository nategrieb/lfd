'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { startRotationWorkout } from './actions'
import { TYPE_PILL, type WorkoutType } from '@/lib/workout-types'

export type RotationOption = { hint: string | null; ago: string }

/** Your rotation: the suggested type is selected; tap another pill to choose it. Start copies your last one. */
export default function RotationCard({ types, suggested, options }: { types: WorkoutType[]; suggested: WorkoutType; options: Record<string, RotationOption> }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [chosen, setChosen] = useState<WorkoutType>(suggested)
  const [error, setError] = useState<string | null>(null)
  const option = options[chosen]

  return (
    <div className="rounded-3xl border border-zinc-100 bg-white px-6 py-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Your rotation</p>
        <Link href="/programs" className="text-[11px] font-semibold text-zinc-400 hover:text-zinc-700">
          Change
        </Link>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label="Which workout">
        {types.map((type) => {
          const on = type === chosen
          return (
            <button
              key={type}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setChosen(type)}
              className={`rounded-full px-3 py-1.5 text-xs font-bold ring-1 ring-inset transition-colors ${on ? TYPE_PILL[type] : 'bg-white text-zinc-400 ring-zinc-200'}`}
            >
              {type}
              {type === suggested && <span className={`ml-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle ${on ? 'bg-current' : 'bg-zinc-400'}`} aria-label="suggested next" />}
            </button>
          )
        })}
      </div>

      <p className="mt-3 text-sm font-semibold text-zinc-900">
        {chosen}
        {chosen === suggested && <span className="ml-2 text-xs font-medium text-zinc-400">next up</span>}
        <span className="ml-2 text-xs font-medium text-zinc-400">last {option.ago}</span>
      </p>
      <p className="mt-0.5 text-xs text-zinc-500">{option.hint ?? `You haven’t logged a ${chosen} yet, so this starts empty.`}</p>

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

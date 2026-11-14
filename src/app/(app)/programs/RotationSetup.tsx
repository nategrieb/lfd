'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { saveRotation } from '../start/actions'
import { ROTATION_PRESETS } from '@/lib/rotation'
import { TYPE_PILL, WORKOUT_TYPES, cleanTypes, type WorkoutType } from '@/lib/workout-types'

/** Pick the workout types you cycle through. The Lift tab then suggests whichever you did longest ago. */
export default function RotationSetup({ initial }: { initial: WorkoutType[] }) {
  const router = useRouter()
  const [types, setTypes] = useState<WorkoutType[]>(initial)
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  const dirty = cleanTypes(types).join() !== cleanTypes(initial).join()

  const toggle = (type: WorkoutType) => setTypes((prev) => (prev.includes(type) ? prev.filter((t) => t !== type) : cleanTypes([...prev, type])))

  return (
    <section className="mb-8 rounded-3xl border border-zinc-100 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-zinc-900">Your rotation</h2>
      <p className="mt-0.5 text-xs text-zinc-400">
        The workouts you cycle through, in any order. The Lift tab suggests whichever you did longest ago, and starts it from your last one.
      </p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {WORKOUT_TYPES.map((type) => {
          const on = types.includes(type)
          return (
            <button
              key={type}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(type)}
              className={`rounded-full px-3 py-1.5 text-xs font-bold ring-1 ring-inset transition-colors ${on ? TYPE_PILL[type] : 'bg-white text-zinc-400 ring-zinc-200'}`}
            >
              {type}
            </button>
          )
        })}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {ROTATION_PRESETS.map((preset) => (
          <button key={preset.label} type="button" onClick={() => setTypes(preset.types)} className="rounded-lg bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-200">
            {preset.label}
          </button>
        ))}
        {types.length > 0 && (
          <button type="button" onClick={() => setTypes([])} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-zinc-400 hover:text-zinc-700">
            No rotation
          </button>
        )}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          disabled={pending || !dirty}
          onClick={() =>
            startTransition(async () => {
              setMessage(null)
              const result = await saveRotation(types)
              if (result.error) setMessage(result.error)
              else {
                setMessage('Saved')
                router.refresh()
              }
            })
          }
          className="rounded-xl px-5 py-2 text-sm font-bold text-white disabled:opacity-40"
          style={{ background: 'linear-gradient(135deg, #166534, #16a34a)' }}
        >
          {pending ? 'Saving…' : 'Save'}
        </button>
        {message && <span className={`text-xs ${message === 'Saved' ? 'text-green-700' : 'text-rose-500'}`}>{message}</span>}
      </div>
    </section>
  )
}

'use client'

import { useEffect, useState, useTransition } from 'react'
import { addSet } from '../actions'

type AddSetFormProps = {
  workoutId: string
  exerciseName: string
  defaultWeight?: number
  defaultReps?: number
  onAdded?: (set: { id: string; exercise_name: string; weight: number; reps: number; created_at: string }) => void
}

function asInputValue(value?: number) {
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : ''
}

export default function AddSetForm({
  workoutId,
  exerciseName,
  defaultWeight,
  defaultReps,
  onAdded,
}: AddSetFormProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [formState, setFormState] = useState({
    weight: asInputValue(defaultWeight),
    reps: asInputValue(defaultReps),
  })
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const bumpWeight = (delta: number) => {
    const current = Number(formState.weight)
    if (Number.isNaN(current)) {
      return
    }

    const next = Math.max(0, current + delta)
    setFormState((prev) => ({ ...prev, weight: String(next) }))
  }

  useEffect(() => {
    setFormState({
      weight: asInputValue(defaultWeight),
      reps: asInputValue(defaultReps),
    })
  }, [exerciseName, defaultWeight, defaultReps])

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target
    setFormState((current) => ({ ...current, [name]: value }))
  }

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setMessage(null)

    const formData = new FormData(event.currentTarget)
    formData.set('workout_id', workoutId)
    formData.set('exercise_name', exerciseName)

    startTransition(async () => {
      const result = await addSet(formData)
      if (!result.success) {
        setMessage(result.message ?? 'Unable to add set.')
      } else {
        setMessage(null)
        if (result.set) {
          setFormState({
            weight: String(result.set.weight),
            reps: String(result.set.reps),
          })
        }
        if (result.set && onAdded) {
          onAdded(result.set)
        }
        setIsOpen(false)
      }
    })
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-xs font-semibold text-zinc-100 hover:bg-zinc-800"
      >
        <span className="text-sm leading-none">+</span>
        Add set
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <div className="grid grid-cols-[1fr,1fr,auto] items-end gap-2">
        <div>
          <label className="block text-xs font-medium text-zinc-300">Weight</label>
          <input
            name="weight"
            type="number"
            step="0.5"
            value={formState.weight}
            onChange={handleChange}
            className="mt-1 h-10 w-full rounded-lg border border-zinc-800 bg-zinc-950/70 px-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="mt-1 flex items-center gap-1.5">
            {[2.5, 5, 10].map((step) => (
              <button
                key={step}
                type="button"
                onClick={() => bumpWeight(step)}
                className="rounded-full border border-zinc-700 px-2 py-0.5 text-[11px] font-semibold text-zinc-200 hover:bg-zinc-800"
              >
                +{step}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-300">Reps</label>
          <input
            name="reps"
            type="number"
            min="1"
            value={formState.reps}
            onChange={handleChange}
            className="mt-1 h-10 w-full rounded-lg border border-zinc-800 bg-zinc-950/70 px-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-2 pb-[2px]">
          <button
            type="submit"
            disabled={isPending}
            className="h-10 rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? 'Adding…' : 'Add'}
          </button>
          <button
            type="button"
            onClick={() => {
              setIsOpen(false)
              setMessage(null)
            }}
            className="h-10 rounded-lg border border-zinc-700 px-3 text-xs font-semibold text-zinc-200 hover:bg-zinc-800"
          >
            Cancel
          </button>
        </div>
      </div>

      {message ? (
        <p className="rounded-lg bg-zinc-800/70 px-3 py-2 text-xs text-zinc-200">{message}</p>
      ) : null}
    </form>
  )
}

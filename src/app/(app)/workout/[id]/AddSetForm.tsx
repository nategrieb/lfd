'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { addSet } from '../actions'

type AddSetFormProps = {
  workoutId: string
  exerciseName: string
  defaultWeight?: number
  defaultReps?: number
  onAdded?: (set: { id: string; exercise_name: string; weight: number; reps: number; rpe: number | null; created_at: string }) => void
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
    rpe: '',
  })
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const weightRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setFormState({
      weight: asInputValue(defaultWeight),
      reps: asInputValue(defaultReps),
      rpe: '',
    })
  }, [exerciseName, defaultWeight, defaultReps])

  useEffect(() => {
    if (isOpen) weightRef.current?.focus()
  }, [isOpen])

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
            rpe: result.set.rpe != null ? String(result.set.rpe) : '',
          })
        }
        if (result.set && onAdded) {
          onAdded({ ...result.set, rpe: result.set.rpe ?? null })
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
        className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-50"
      >
        <span className="text-sm leading-none">+</span>
        Add set
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="rounded-xl border border-green-200 bg-green-50 px-3 py-2">
        <div className="grid grid-cols-[22px_minmax(0,1fr)_minmax(0,1fr)_64px_36px] items-center gap-2">
          <span className="text-xs font-medium text-zinc-600">+</span>

          <input
            ref={weightRef}
            name="weight"
            type="number"
            step="0.5"
            placeholder="lbs"
            value={formState.weight}
            onChange={handleChange}
            className="h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-green-700"
          />
          <input
            name="reps"
            type="number"
            min="1"
            placeholder="reps"
            value={formState.reps}
            onChange={handleChange}
            className="h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-green-700"
          />
          <input
            name="rpe"
            type="number"
            step="0.5"
            min="1"
            max="10"
            placeholder="RPE"
            value={formState.rpe}
            onChange={handleChange}
            className="h-10 rounded-lg border border-zinc-200 bg-white px-2 text-center text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-green-700"
          />

          <button
            type="submit"
            disabled={isPending}
            aria-label="Save set"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #166534, #16a34a)' }}
          >
            {isPending ? (
              <span className="text-[10px]">…</span>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="h-4 w-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            )}
          </button>
        </div>

        <div className="mt-1.5 flex items-center gap-3 pl-[30px]">
          <button
            type="button"
            onClick={() => { setIsOpen(false); setMessage(null) }}
            className="text-xs text-zinc-400 hover:text-zinc-600"
          >
            Cancel
          </button>
          {message ? <span className="text-xs text-rose-400">{message}</span> : null}
        </div>
      </div>
    </form>
  )
}

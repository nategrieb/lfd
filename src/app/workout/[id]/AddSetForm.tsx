'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { addSet } from '../actions'

type AddSetFormProps = {
  workoutId: string
  onAdded?: (set: { id: string; exercise_name: string; weight: number; reps: number; created_at: string }) => void
}

export default function AddSetForm({ workoutId, onAdded }: AddSetFormProps) {
  const router = useRouter()
  const [formState, setFormState] = useState({
    exercise_name: 'Squat',
    weight: '',
    reps: '',
  })
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = event.target
    setFormState((current) => ({ ...current, [name]: value }))
  }

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setMessage(null)

    const formData = new FormData(event.currentTarget)
    formData.set('workout_id', workoutId)

    startTransition(async () => {
      const result = await addSet(formData)
      if (!result.success) {
        setMessage(result.message ?? 'Unable to add set.')
      } else {
        setMessage('Set added!')
        setFormState({ exercise_name: 'Squat', weight: '', reps: '' })
        if (result.set && onAdded) {
          onAdded(result.set)
        }
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="block text-sm font-medium text-zinc-200">Exercise</label>
          <select
            name="exercise_name"
            value={formState.exercise_name}
            onChange={handleChange}
            className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-950/70 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="Squat">Squat</option>
            <option value="Bench">Bench</option>
            <option value="Deadlift">Deadlift</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-200">Weight (lbs)</label>
          <input
            name="weight"
            type="number"
            step="0.5"
            value={formState.weight}
            onChange={handleChange}
            className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-950/70 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-200">Reps</label>
          <input
            name="reps"
            type="number"
            min="1"
            value={formState.reps}
            onChange={handleChange}
            className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-950/70 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {message ? (
        <p className="rounded-lg bg-zinc-800/70 px-4 py-3 text-sm text-zinc-200">{message}</p>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className="text-lg">➕</span>
        {isPending ? 'Adding…' : 'Add Set'}
      </button>
    </form>
  )
}

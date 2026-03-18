'use client'

import { useMemo, useState } from 'react'
import { addSet, deleteSet, finishWorkout } from '../actions'
import AddSetForm from './AddSetForm'

type WorkoutSet = {
  id: string
  exercise_name: string
  weight: number
  reps: number
  created_at: string
}

type WorkoutSessionProps = {
  workoutId: string
  initialSets: WorkoutSet[]
}

export default function WorkoutSession({ workoutId, initialSets }: WorkoutSessionProps) {
  const [sets, setSets] = useState<WorkoutSet[]>(initialSets)
  const [message, setMessage] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState<string | null>(null)

  const groupedSets = useMemo(() => {
    return sets.reduce<Record<string, WorkoutSet[]>>((acc, set) => {
      const exercise = set.exercise_name ?? 'Unknown'
      if (!acc[exercise]) acc[exercise] = []
      acc[exercise].push(set)
      return acc
    }, {})
  }, [sets])

  const totalSets = sets.length
  const totalVolume = useMemo(() => sets.reduce((acc, set) => acc + set.weight * set.reps, 0), [sets])
  const formattedVolume = useMemo(() => new Intl.NumberFormat('en-US').format(totalVolume), [totalVolume])

  const handleSetAdded = (set: WorkoutSet) => {
    setSets((prev) => [...prev, set])
    setMessage('Set added!')
    setTimeout(() => setMessage(null), 2500)
  }

  const handleDelete = async (setId: string) => {
    setIsDeleting(setId)
    const result = await deleteSet({ setId, workoutId })
    setIsDeleting(null)

    if (!result.success) {
      setMessage(result.message ?? 'Failed to delete set.')
      setTimeout(() => setMessage(null), 2500)
      return
    }

    setSets((prev) => prev.filter((set) => set.id !== setId))
  }

  return (
    <>
      <div className="mt-6 space-y-4">
        {sets.length ? (
          Object.entries(groupedSets).map(([exerciseName, exerciseSets]) => (
            <div key={exerciseName} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-white">{exerciseName}</p>
                  <p className="text-xs text-zinc-400">
                    {exerciseSets.length} set{exerciseSets.length === 1 ? '' : 's'}
                  </p>
                </div>
                <span className="text-xs text-zinc-400">
                  Latest: {new Date(exerciseSets[exerciseSets.length - 1].created_at).toLocaleTimeString()}
                </span>
              </div>

              <ul className="mt-4 space-y-2">
                {exerciseSets.map((set, index) => (
                  <li
                    key={set.id}
                    className="flex items-start justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-950/40 px-4 py-3"
                  >
                    <div>
                      <p className="text-sm text-zinc-200">Set {index + 1}</p>
                      <p className="text-sm text-zinc-300">
                        {set.weight} lbs × {set.reps} reps
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDelete(set.id)}
                      disabled={isDeleting === set.id}
                      className="rounded-lg bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-200 hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isDeleting === set.id ? 'Deleting…' : 'Delete'}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))
        ) : (
          <p className="text-sm text-zinc-400">No sets logged yet. Add your first set below.</p>
        )}
      </div>

      <div className="mt-8">
        {message ? (
          <div className="rounded-lg bg-zinc-800/70 px-4 py-3 text-sm text-zinc-200">{message}</div>
        ) : null}

        <AddSetForm workoutId={workoutId} onAdded={handleSetAdded} />
      </div>

      <div className="mt-6 border-t border-zinc-800 pt-4">
        <p className="text-sm text-zinc-400">Workout total</p>
        <p className="text-3xl font-semibold">{formattedVolume} lbs</p>
        <p className="text-xs text-zinc-400">{totalSets} set{totalSets === 1 ? '' : 's'}</p>

        <form action={finishWorkout} className="mt-6 flex items-center justify-between gap-3">
          <input type="hidden" name="workout_id" value={workoutId} />
          <button
            type="submit"
            className="rounded-xl bg-white px-5 py-3 font-semibold text-black"
          >
            Finish workout
          </button>
        </form>
      </div>
    </>
  )
}

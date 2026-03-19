'use client'

import { useTransition, useState } from 'react'
import { useRouter } from 'next/navigation'
import { deleteWorkout } from '../../actions'

export default function DeleteWorkoutButton({ workoutId }: { workoutId: string }) {
  const [confirming, setConfirming] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  if (confirming) {
    return (
      <div className="rounded-2xl border border-red-900/60 bg-red-950/40 p-4">
        <p className="text-sm font-semibold text-red-300">Delete this workout?</p>
        <p className="mt-1 text-xs text-red-400/80">
          This will permanently delete all sets and any uploaded videos. This cannot be undone.
        </p>
        {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={() => setConfirming(false)}
            disabled={isPending}
            className="flex-1 rounded-xl border border-zinc-700 py-2.5 text-sm font-semibold text-zinc-300 transition active:bg-zinc-800 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => {
              setError(null)
              startTransition(async () => {
                const result = await deleteWorkout({ workoutId })
                if (result.success) {
                  router.push('/history')
                } else {
                  setError(result.message ?? 'Failed to delete workout.')
                }
              })
            }}
            className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white transition hover:bg-red-500 disabled:opacity-50"
          >
            {isPending ? 'Deleting…' : 'Yes, delete'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-900/50 py-3 text-sm font-semibold text-red-400 transition hover:border-red-700 hover:bg-red-950/30 hover:text-red-300"
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
        <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
      </svg>
      Delete workout
    </button>
  )
}

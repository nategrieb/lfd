'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { startWorkout } from './actions'

export default function StartWorkoutButton() {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  return (
    <button
      type="button"
      onClick={() => {
        startTransition(async () => {
          const result = await startWorkout()
          if (result.success && result.id) {
            router.push(`/workout/${result.id}`)
          }
        })
      }}
      disabled={isPending}
      className="flex w-full max-w-sm items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 text-lg font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span className="text-xl">➕</span>
      {isPending ? 'Starting…' : 'Start New Workout'}
    </button>
  )
}

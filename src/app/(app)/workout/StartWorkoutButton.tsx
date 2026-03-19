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
      className="flex h-14 w-full items-center justify-between rounded-xl px-4 text-base font-semibold text-white shadow-lg transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      style={{ background: 'linear-gradient(135deg, #166534, #16a34a)' }}
    >
      <span>{isPending ? 'Starting…' : 'Start New Workout'}</span>
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/15">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="h-4 w-4"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
        </svg>
      </span>
    </button>
  )
}

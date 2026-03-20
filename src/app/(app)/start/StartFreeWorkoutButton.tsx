'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { startFreeWorkout } from './actions'

export default function StartFreeWorkoutButton() {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          const result = await startFreeWorkout()
          if (result.id) router.push(`/workout/${result.id}`)
        })
      }
      className="rounded-xl border border-zinc-200 px-5 py-2.5 text-sm font-bold text-zinc-800 transition hover:bg-zinc-50 disabled:opacity-60"
    >
      {isPending ? 'Starting…' : 'Start free workout'}
    </button>
  )
}

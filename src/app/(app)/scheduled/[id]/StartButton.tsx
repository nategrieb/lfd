'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { startScheduledWorkout } from '@/app/(app)/workout/actions'

export default function StartButton({ scheduledId }: { scheduledId: string }) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          const result = await startScheduledWorkout(scheduledId)
          if (result.success) router.push(`/workout/${result.id}`)
        })
      }
      className="w-full rounded-2xl bg-amber-500 py-4 text-base font-bold text-black transition hover:bg-amber-400 disabled:opacity-60"
    >
      {isPending ? 'Starting…' : 'Start Workout'}
    </button>
  )
}

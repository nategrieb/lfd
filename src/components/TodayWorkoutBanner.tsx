'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { startScheduledWorkout } from '@/app/(app)/workout/actions'

type Props = {
  scheduledId: string
  workoutName: string
}

export default function TodayWorkoutBanner({ scheduledId, workoutName }: Props) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const handleStart = () => {
    startTransition(async () => {
      const result = await startScheduledWorkout(scheduledId)
      if (result.success) {
        router.push(`/workout/${result.id}`)
      }
    })
  }

  return (
    <div className="mb-4 flex items-center justify-between rounded-2xl border border-amber-600/40 bg-amber-900/20 px-5 py-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-amber-500">Today</p>
        <p className="mt-0.5 text-sm font-semibold text-white">{workoutName}</p>
      </div>
      <button
        type="button"
        onClick={handleStart}
        disabled={isPending}
        className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-black transition hover:bg-amber-400 disabled:opacity-60"
      >
        {isPending ? 'Starting…' : 'Start'}
      </button>
    </div>
  )
}

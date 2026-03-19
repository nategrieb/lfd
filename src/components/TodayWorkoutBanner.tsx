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
    <div className="mb-4 flex items-center justify-between rounded-2xl border border-green-700/20 bg-green-50 px-5 py-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-green-700">Today</p>
        <p className="mt-0.5 text-sm font-semibold text-zinc-900">{workoutName}</p>
      </div>
      <button
        type="button"
        onClick={handleStart}
        disabled={isPending}
        className="rounded-xl px-4 py-2 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-60"
        style={{ background: 'linear-gradient(135deg, #166534, #16a34a)' }}
      >
        {isPending ? 'Starting…' : 'Start'}
      </button>
    </div>
  )
}

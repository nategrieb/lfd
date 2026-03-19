'use client'

import { useTransition } from 'react'
import { unenrollFromProgram } from './actions'

export default function UnenrollButton({
  enrollmentId,
  templateId,
}: {
  enrollmentId: string
  templateId: string
}) {
  const [isPending, startTransition] = useTransition()

  const handleClick = () => {
    if (!confirm('Leave this program? Future planned workouts will be removed from your calendar.')) return
    startTransition(async () => { await unenrollFromProgram(enrollmentId, templateId) })
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className="mt-3 w-full rounded-xl border border-zinc-700 py-2.5 text-sm font-semibold text-zinc-400 transition hover:border-zinc-500 hover:text-zinc-200 disabled:opacity-50"
    >
      {isPending ? 'Leaving…' : 'Leave program'}
    </button>
  )
}

'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { startRotationWorkout } from '@/app/(app)/start/actions'

/** Feed shortcut: start whichever workout is next in your rotation, copied from your last one. One tap. */
export default function StartRotationButton({ type, hint }: { type: string; hint: string | null }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null)
            const result = await startRotationWorkout(type)
            if (result.id) router.push(`/workout/${result.id}`)
            else setError(result.error ?? 'Could not start.')
          })
        }
        className="flex w-full flex-col items-center justify-center rounded-2xl px-6 py-4 text-white shadow-lg transition hover:opacity-90 disabled:opacity-60"
        style={{ background: 'linear-gradient(135deg, #166534, #16a34a)' }}
      >
        <span className="text-lg font-semibold">{pending ? 'Starting…' : `Start ${type}`}</span>
        {hint && !pending && <span className="mt-0.5 text-xs font-medium text-green-100">{hint}</span>}
      </button>
      {error && <p className="mt-2 text-center text-xs text-rose-500">{error}</p>}
    </div>
  )
}

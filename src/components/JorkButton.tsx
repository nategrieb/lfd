'use client'

import { useState, useTransition } from 'react'
import { toggleJork } from '@/app/(app)/workout/social-actions'
import WaterSplash from './WaterSplash'

type Props = {
  workoutId: string
  workoutOwnerId: string
  initialCount: number
  initialHasJorked: boolean
}

export default function JorkButton({ workoutId, workoutOwnerId, initialCount, initialHasJorked }: Props) {
  const [hasJorked, setHasJorked] = useState(initialHasJorked)
  const [count, setCount] = useState(initialCount)
  const [isPending, startTransition] = useTransition()
  const [splashing, setSplashing] = useState(false)

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    const next = !hasJorked
    // Optimistic update
    setHasJorked(next)
    setCount(c => next ? c + 1 : Math.max(0, c - 1))
    // Water effect only when jorking, not un-jorking
    if (next) setSplashing(true)

    startTransition(async () => {
      const result = await toggleJork(workoutId, workoutOwnerId)
      if ('error' in result) {
        // Revert on failure
        setHasJorked(!next)
        setCount(c => next ? Math.max(0, c - 1) : c + 1)
        setSplashing(false)
      }
    })
  }

  return (
    <>
      {splashing && <WaterSplash onDone={() => setSplashing(false)} />}
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        title={hasJorked ? 'Un-jork' : 'Jork their beanits'}
        className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-semibold transition-colors ${
          hasJorked
            ? 'bg-green-50 text-green-700'
            : 'text-zinc-400 hover:bg-zinc-50 hover:text-zinc-600'
        }`}
      >
        <span className="text-base leading-none" aria-hidden="true">🤘</span>
        {count > 0 && <span className="tabular-nums leading-none">{count}</span>}
        <span className="sr-only">{hasJorked ? 'Jorked' : 'Jork their beanits'}</span>
      </button>
    </>
  )
}


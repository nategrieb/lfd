'use client'

import { useRouter } from 'next/navigation'
import { canGoBackInApp } from '@/components/NavHistory'

type Props = {
  /** Where to go when there is nothing to go back to (opened from a link, or a fresh tab). */
  fallback: string
  label?: string
  className?: string
}

const DEFAULT_CLASS =
  'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-zinc-200 text-zinc-400 transition-colors hover:border-zinc-300 hover:text-zinc-700'

/** Back goes to the screen you came from; with no earlier screen it goes to this one's parent. */
export default function BackButton({ fallback, label = 'Back', className = DEFAULT_CLASS }: Props) {
  const router = useRouter()

  return (
    <button
      type="button"
      aria-label={label}
      className={className}
      onClick={() => {
        if (canGoBackInApp()) router.back()
        else router.push(fallback)
      }}
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
        <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
      </svg>
    </button>
  )
}

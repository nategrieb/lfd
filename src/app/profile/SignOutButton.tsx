'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { signOut } from './actions'

export default function SignOutButton() {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  return (
    <button
      type="button"
      onClick={() => {
        startTransition(async () => {
          const result = await signOut()
          if (result?.success) {
            router.push('/login')
          }
        })
      }}
      disabled={isPending}
      className="rounded-xl bg-red-500/20 px-4 py-2 text-sm font-semibold text-red-100 transition hover:bg-red-500/30 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {isPending ? 'Signing out…' : 'Sign out'}
    </button>
  )
}

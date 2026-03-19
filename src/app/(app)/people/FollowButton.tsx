'use client'

import { useTransition, useState } from 'react'
import { followUser, unfollowUser } from './actions'

type Props = {
  userId: string
  initialIsFollowing: boolean
}

export default function FollowButton({ userId, initialIsFollowing }: Props) {
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing)
  const [pending, startTransition] = useTransition()

  const handleClick = () => {
    const next = !isFollowing
    setIsFollowing(next) // optimistic
    startTransition(async () => {
      if (next) {
        await followUser(userId)
      } else {
        await unfollowUser(userId)
      }
    })
  }

  return (
    <button
      onClick={handleClick}
      disabled={pending}
      className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors disabled:opacity-50 ${
        isFollowing
          ? 'border border-zinc-600 bg-transparent text-zinc-300 hover:border-red-500 hover:text-red-400'
          : 'bg-amber-500 text-black hover:bg-amber-400'
      }`}
    >
      {isFollowing ? 'Following' : 'Follow'}
    </button>
  )
}

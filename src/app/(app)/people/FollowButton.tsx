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
          ? 'border border-zinc-200 bg-transparent text-zinc-600 hover:border-red-400 hover:text-red-500'
          : 'text-white hover:opacity-90'
      }`}
      style={isFollowing ? undefined : { background: 'linear-gradient(135deg, #166534, #16a34a)' }}
    >
      {isFollowing ? 'Following' : 'Follow'}
    </button>
  )
}

'use client'

import { useEffect, useState, useTransition, useRef } from 'react'
import { fetchComments, addComment, type CommentWithProfile } from '@/app/(app)/workout/social-actions'

type Props = {
  workoutId: string
  workoutOwnerId: string
  onNewComment: () => void
}

export default function CommentsSection({ workoutId, workoutOwnerId, onNewComment }: Props) {
  const [comments, setComments] = useState<CommentWithProfile[]>([])
  const [loaded, setLoaded] = useState(false)
  const [body, setBody] = useState('')
  const [isPending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)

  // Load comments when section first mounts
  useEffect(() => {
    startTransition(async () => {
      const data = await fetchComments(workoutId)
      setComments(data)
      setLoaded(true)
    })
    // Focus input after a tick
    setTimeout(() => inputRef.current?.focus(), 50)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workoutId])

  const submit = () => {
    const trimmed = body.trim()
    if (!trimmed || isPending) return
    setBody('')
    startTransition(async () => {
      const result = await addComment(workoutId, workoutOwnerId, trimmed)
      if ('comment' in result) {
        setComments(prev => [...prev, result.comment])
        onNewComment()
      }
    })
  }

  return (
    <div
      className="border-t border-zinc-100 px-4 pb-4 pt-3"
      onClick={e => e.stopPropagation()}
    >
      {!loaded ? (
        <p className="py-1 text-xs text-zinc-400">Loading…</p>
      ) : comments.length === 0 ? (
        <p className="py-1 text-xs text-zinc-400">No comments yet. Be first!</p>
      ) : (
        <ul className="mb-3 space-y-3">
          {comments.map(c => {
            const name = c.profiles?.display_name || c.profiles?.username || 'User'
            const initial = (name[0] ?? '?').toUpperCase()
            return (
              <li key={c.id} className="flex items-start gap-2.5">
                <div
                  className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full text-[10px] font-bold text-white"
                  style={{ background: 'linear-gradient(135deg, #166534, #16a34a)' }}
                >
                  {c.profiles?.avatar_url
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={c.profiles.avatar_url} alt={name} className="h-full w-full object-cover" />
                    : initial}
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-semibold text-zinc-800">{name} </span>
                  <span className="text-sm text-zinc-700">{c.body}</span>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {/* New comment input */}
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="text"
          value={body}
          onChange={e => setBody(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submit() }}
          placeholder="Add a comment…"
          maxLength={500}
          className="flex-1 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-green-700 focus:bg-white focus:outline-none"
        />
        <button
          type="button"
          onClick={submit}
          disabled={isPending || !body.trim()}
          className="shrink-0 rounded-xl px-4 py-2 text-sm font-bold text-white transition disabled:opacity-40"
          style={{ background: 'linear-gradient(135deg, #166534, #16a34a)' }}
        >
          Post
        </button>
      </div>
    </div>
  )
}

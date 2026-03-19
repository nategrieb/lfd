'use client'

import { useState, useTransition } from 'react'
import { completeOnboarding } from './actions'

export default function OnboardingForm() {
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await completeOnboarding(formData)
      if (result && !result.success) setError(result.message ?? 'Something went wrong.')
    })
  }

  // Live-validate username format as the user types
  const usernameValid = /^[a-z0-9_]{3,30}$/.test(username)
  const usernameHint =
    username.length === 0
      ? null
      : !usernameValid
      ? '3–30 chars · lowercase letters, numbers, underscores'
      : null

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-zinc-200">
          Username <span className="text-amber-500">*</span>
        </label>
        <p className="mt-0.5 text-xs text-zinc-500">How friends find and follow you</p>
        <div className="relative mt-2">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-zinc-500 select-none">
            @
          </span>
          <input
            name="username"
            type="text"
            required
            autoFocus
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase())}
            placeholder="your_handle"
            className={`w-full rounded-xl border py-3 pl-7 pr-4 text-white placeholder:text-zinc-500 bg-zinc-950/70 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-colors ${
              usernameHint ? 'border-red-500' : 'border-zinc-700'
            }`}
          />
        </div>
        {usernameHint && (
          <p className="mt-1.5 text-xs text-red-400">{usernameHint}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-200">Display name</label>
        <p className="mt-0.5 text-xs text-zinc-500">Your real name or nickname shown on the feed (optional)</p>
        <input
          name="display_name"
          type="text"
          autoComplete="name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Alex Johnson"
          className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950/70 px-4 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
        />
      </div>

      {error && (
        <p className="rounded-lg bg-red-900/30 border border-red-700/40 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending || !usernameValid}
        className="w-full rounded-xl bg-amber-500 px-4 py-3 text-sm font-semibold text-black shadow-lg shadow-amber-500/20 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? 'Saving…' : 'Get started →'}
      </button>
    </form>
  )
}

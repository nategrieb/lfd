'use client'

import { useState, useTransition } from 'react'
import { updateProfile } from './actions'

export type ProfileFormProps = {
  username: string
  displayName: string
  squat: number
  bench: number
  deadlift: number
  preferredUnit: 'lb' | 'kg'
}

export default function ProfileForm({ username, displayName, squat, bench, deadlift, preferredUnit }: ProfileFormProps) {
  const [formState, setFormState] = useState({
    username,
    display_name: displayName,
    squat: String(squat),
    bench: String(bench),
    deadlift: String(deadlift),
    preferredUnit,
  })
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = event.target
    setFormState((current) => ({ ...current, [name]: value }))
  }

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setMessage(null)

    const formData = new FormData(event.currentTarget)

    startTransition(async () => {
      const result = await updateProfile(formData)
      if (!result.success) {
        setMessage(result.message ?? 'Unable to save your profile.')
      } else {
        setMessage('Saved!')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">

      {/* ── Identity ──────────────────────────────────────────── */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-zinc-200">Username</label>
          <p className="mt-0.5 text-xs text-zinc-500">How people find and follow you · 3–30 chars, lowercase letters, numbers, underscores</p>
          <div className="relative mt-1">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-zinc-500 select-none">@</span>
            <input
              name="username"
              type="text"
              value={formState.username}
              onChange={handleChange}
              placeholder="your_handle"
              autoComplete="username"
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950/70 py-3 pl-7 pr-4 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-200">Display name</label>
          <p className="mt-0.5 text-xs text-zinc-500">Your real name or nickname shown on the feed</p>
          <input
            name="display_name"
            type="text"
            value={formState.display_name}
            onChange={handleChange}
            placeholder="Alex Johnson"
            autoComplete="name"
            className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-950/70 px-4 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>
      </div>

      {/* ── Lift Stats ────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-zinc-200">Squat 1RM</label>
          <input
            name="squat"
            type="number"
            step="0.5"
            value={formState.squat}
            onChange={handleChange}
            className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-950/70 px-4 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-200">Bench 1RM</label>
          <input
            name="bench"
            type="number"
            step="0.5"
            value={formState.bench}
            onChange={handleChange}
            className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-950/70 px-4 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-200">Deadlift 1RM</label>
          <input
            name="deadlift"
            type="number"
            step="0.5"
            value={formState.deadlift}
            onChange={handleChange}
            className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-950/70 px-4 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-200">Preferred unit</label>
          <select
            name="preferredUnit"
            value={formState.preferredUnit}
            onChange={handleChange}
            className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-950/70 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="lb">lb</option>
            <option value="kg">kg</option>
          </select>
        </div>
      </div>

      {message ? (
        <p className="rounded-lg bg-zinc-800/70 px-4 py-3 text-sm text-zinc-200">{message}</p>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? 'Saving…' : 'Save profile'}
      </button>
    </form>
  )
}

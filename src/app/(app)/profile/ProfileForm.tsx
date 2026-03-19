'use client'

import { useRef, useState, useTransition } from 'react'
import { updateProfile } from './actions'
import { createClient } from '@/lib/supabase'

export type ProfileFormProps = {
  userId: string
  username: string
  displayName: string
  avatarUrl?: string | null
  squat: number
  bench: number
  deadlift: number
  preferredUnit: 'lb' | 'kg'
}

export default function ProfileForm({ userId, username, displayName, avatarUrl, squat, bench, deadlift, preferredUnit }: ProfileFormProps) {
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
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = event.target
    setFormState((current) => ({ ...current, [name]: value }))
  }

  const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setPendingFile(file)
    setPreviewUrl(URL.createObjectURL(file))
  }

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setMessage(null)

    const formData = new FormData(event.currentTarget)

    startTransition(async () => {
      if (pendingFile) {
        const supabase = createClient()
        const ext = pendingFile.name.split('.').pop() ?? 'jpg'
        const path = `${userId}/avatar.${ext}`
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(path, pendingFile, { upsert: true, contentType: pendingFile.type })
        if (uploadError) {
          setMessage('Photo upload failed: ' + uploadError.message)
          return
        }
        const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
        // Append cache-buster so the browser fetches the new image
        formData.set('avatar_url', `${urlData.publicUrl}?t=${Date.now()}`)
      }

      const result = await updateProfile(formData)
      if (!result.success) {
        setMessage(result.message ?? 'Unable to save your profile.')
      } else {
        setMessage('Saved!')
      }
    })
  }

  const displaySrc = previewUrl ?? avatarUrl ?? null
  const initial = (formState.display_name?.[0] || formState.username?.[0] || '?').toUpperCase()

  return (
    <form onSubmit={handleSubmit} className="space-y-6">

      {/* ── Avatar ────────────────────────────────────────────── */}
      <div className="flex flex-col items-center gap-2">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="group relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-amber-500 text-2xl font-bold text-black ring-2 ring-transparent transition hover:ring-amber-400 focus:outline-none focus:ring-amber-400"
          aria-label="Change profile photo"
        >
          {displaySrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={displaySrc} alt="Profile photo" className="h-full w-full object-cover" />
          ) : (
            initial
          )}
          <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6 text-white" aria-hidden="true">
              <path d="M12 9a3.75 3.75 0 100 7.5A3.75 3.75 0 0012 9z" />
              <path fillRule="evenodd" d="M9.344 3.071a49.52 49.52 0 015.312 0c.967.052 1.83.585 2.332 1.39l.821 1.317c.24.383.645.643 1.11.71.386.054.77.113 1.152.177 1.432.239 2.429 1.493 2.429 2.909V18a3 3 0 01-3 3h-15a3 3 0 01-3-3V9.574c0-1.416.997-2.67 2.429-2.909.382-.064.766-.123 1.151-.178a1.56 1.56 0 001.11-.71l.822-1.315a2.942 2.942 0 012.332-1.39zM6.75 12.75a5.25 5.25 0 1110.5 0 5.25 5.25 0 01-10.5 0z" clipRule="evenodd" />
            </svg>
          </span>
        </button>
        <p className="text-xs text-zinc-500">Tap to change photo</p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={handleAvatarChange}
          aria-label="Upload profile photo"
        />
      </div>

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

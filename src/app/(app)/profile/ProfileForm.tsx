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
    <form onSubmit={handleSubmit} className="space-y-5">

      {/* ── Avatar ────────────────────────────────────────────── */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="group relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full text-lg font-bold text-white ring-2 ring-transparent transition hover:ring-green-700 focus:outline-none focus:ring-green-700"
          style={{ background: 'linear-gradient(135deg, #166534, #16a34a)' }}
          aria-label="Change profile photo"
        >
          {displaySrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={displaySrc} alt="Profile photo" className="h-full w-full object-cover" />
          ) : (
            initial
          )}
          <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 text-white" aria-hidden="true">
              <path d="M12 9a3.75 3.75 0 100 7.5A3.75 3.75 0 0012 9z" />
              <path fillRule="evenodd" d="M9.344 3.071a49.52 49.52 0 015.312 0c.967.052 1.83.585 2.332 1.39l.821 1.317c.24.383.645.643 1.11.71.386.054.77.113 1.152.177 1.432.239 2.429 1.493 2.429 2.909V18a3 3 0 01-3 3h-15a3 3 0 01-3-3V9.574c0-1.416.997-2.67 2.429-2.909.382-.064.766-.123 1.151-.178a1.56 1.56 0 001.11-.71l.822-1.315a2.942 2.942 0 012.332-1.39zM6.75 12.75a5.25 5.25 0 1110.5 0 5.25 5.25 0 01-10.5 0z" clipRule="evenodd" />
            </svg>
          </span>
        </button>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-zinc-400 select-none text-sm">@</span>
            <input
              name="username"
              type="text"
              value={formState.username}
              onChange={handleChange}
              placeholder="username"
              autoComplete="username"
              className="w-full rounded-lg border border-zinc-200 bg-zinc-50 py-2 pl-6 pr-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-green-700"
            />
          </div>
          <input
            name="display_name"
            type="text"
            value={formState.display_name}
            onChange={handleChange}
            placeholder="Display name"
            autoComplete="name"
            className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-green-700"
          />
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={handleAvatarChange}
          aria-label="Upload profile photo"
        />
      </div>

      {/* ── Lift Stats ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { name: 'squat',    label: 'Squat 1RM',    value: formState.squat },
          { name: 'bench',    label: 'Bench 1RM',    value: formState.bench },
          { name: 'deadlift', label: 'Deadlift 1RM', value: formState.deadlift },
        ].map((f) => (
          <div key={f.name}>
            <label className="block text-[11px] font-medium uppercase tracking-wide text-zinc-400">{f.label}</label>
            <input
              name={f.name}
              type="number"
              step="0.5"
              value={f.value}
              onChange={handleChange}
              className="mt-1 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-green-700"
            />
          </div>
        ))}
        <div>
          <label className="block text-[11px] font-medium uppercase tracking-wide text-zinc-400">Unit</label>
          <select
            name="preferredUnit"
            value={formState.preferredUnit}
            onChange={handleChange}
            className="mt-1 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-green-700"
          >
            <option value="lb">lb</option>
            <option value="kg">kg</option>
          </select>
        </div>
      </div>

      {message ? (
        <p className={`rounded-lg px-3 py-2 text-sm ${
          message === 'Saved!' ? 'bg-green-50 text-green-700' : 'bg-zinc-100 text-zinc-600'
        }`}>{message}</p>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        style={{ background: 'linear-gradient(135deg, #166534, #16a34a)' }}
      >
        {isPending ? 'Saving…' : 'Save'}
      </button>
    </form>
  )
}

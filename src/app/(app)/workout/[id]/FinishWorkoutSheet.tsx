'use client'

import { useRef, useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase'
import { finishWorkout } from '../actions'

type Props = {
  workoutId: string
  userId: string
  onClose: () => void
  onBeforeFinish: () => Promise<boolean>
}

export default function FinishWorkoutSheet({ workoutId, userId, onClose, onBeforeFinish }: Props) {
  const [location, setLocation] = useState('')
  const [photos, setPhotos] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const incoming = Array.from(e.target.files ?? [])
    if (!incoming.length) return
    const combined = [...photos, ...incoming].slice(0, 5)
    setPhotos(combined)
    setPreviews(combined.map((f) => URL.createObjectURL(f)))
    e.target.value = ''
  }

  const removePhoto = (index: number) => {
    const next = photos.filter((_, i) => i !== index)
    setPhotos(next)
    setPreviews(next.map((f) => URL.createObjectURL(f)))
  }

  const handleComplete = () => {
    startTransition(async () => {
      setMessage(null)
      const ok = await onBeforeFinish()
      if (!ok) return

      const formData = new FormData()
      formData.set('workout_id', workoutId)
      if (location.trim()) formData.set('location', location.trim())

      if (photos.length > 0) {
        const supabase = createClient()
        const timestamp = Date.now()
        for (let i = 0; i < photos.length; i++) {
          const file = photos[i]
          const ext = file.name.split('.').pop() ?? 'jpg'
          const path = `${userId}/${workoutId}/${timestamp}-${i}.${ext}`
          const { error: uploadError } = await supabase.storage
            .from('workout-post-photos')
            .upload(path, file, { upsert: true, contentType: file.type })
          if (uploadError) {
            setMessage('Photo upload failed: ' + uploadError.message)
            return
          }
          const { data: urlData } = supabase.storage
            .from('workout-post-photos')
            .getPublicUrl(path)
          formData.append('post_photos', urlData.publicUrl)
        }
      }

      await finishWorkout(formData)
    })
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end bg-black/70"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full rounded-t-3xl border-t border-zinc-700 bg-zinc-950 p-6 max-h-[90dvh] overflow-y-auto" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 5rem)' }}>

        {/* Handle + header */}
        <div className="mb-1 flex justify-center">
          <div className="h-1 w-10 rounded-full bg-zinc-700" />
        </div>
        <div className="mb-6 mt-3 flex items-center justify-between">
          <h2 className="text-xl font-extrabold tracking-tight">Complete workout</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>

        {/* Location */}
        <div className="mb-6">
          <label className="mb-1.5 block text-sm font-semibold text-zinc-200">
            Where did you lift?
          </label>
          <p className="mb-2 text-xs text-zinc-500">Gym, home, or wherever you trained today</p>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-zinc-500">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
                <path fillRule="evenodd" d="M9.69 18.933l.003.001C9.89 19.02 10 19 10 19s.11.02.308-.066l.002-.001.006-.003.018-.008a5.741 5.741 0 00.281-.145 13.39 13.39 0 002.206-1.72C14.047 15.497 16 12.51 16 9.5a6 6 0 00-12 0c0 3.01 1.953 5.998 3.168 7.307a13.39 13.39 0 002.523 1.865zm-.004-12.183a2.25 2.25 0 113.182 3.182 2.25 2.25 0 01-3.182-3.182z" clipRule="evenodd" />
              </svg>
            </span>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Equinox, Home gym…"
              maxLength={100}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-900 py-3 pl-9 pr-4 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
        </div>

        {/* Post photos */}
        <div className="mb-6">
          <label className="mb-1.5 block text-sm font-semibold text-zinc-200">
            Post photos
            <span className="ml-2 text-xs font-normal text-zinc-500">optional · up to 5</span>
          </label>
          <p className="mb-3 text-xs text-zinc-500">
            Selfies, PRs, anything you want to share with your followers
          </p>

          {previews.length > 0 && (
            <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
              {previews.map((src, i) => (
                <div key={i} className="relative h-24 w-24 shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={src}
                    alt={`Post photo ${i + 1}`}
                    className="h-full w-full rounded-xl object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removePhoto(i)}
                    aria-label={`Remove photo ${i + 1}`}
                    className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-zinc-950 text-white ring-1 ring-zinc-700 hover:bg-zinc-800"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3" aria-hidden="true">
                      <path d="M5.28 4.22a.75.75 0 00-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 101.06 1.06L8 9.06l2.72 2.72a.75.75 0 101.06-1.06L9.06 8l2.72-2.72a.75.75 0 00-1.06-1.06L8 6.94 5.28 4.22z" />
                    </svg>
                  </button>
                </div>
              ))}

              {photos.length < 5 && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex h-24 w-24 shrink-0 items-center justify-center rounded-xl border-2 border-dashed border-zinc-700 text-zinc-500 hover:border-zinc-500 hover:text-zinc-300"
                  aria-label="Add another photo"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-6 w-6" aria-hidden="true">
                    <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
                  </svg>
                </button>
              )}
            </div>
          )}

          {photos.length === 0 && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-zinc-700 py-5 text-sm font-medium text-zinc-400 hover:border-zinc-500 hover:text-zinc-200 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
              </svg>
              Add photos
            </button>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            onChange={handleFileChange}
            aria-label="Upload post photos"
          />
        </div>

        {message && (
          <p className="mb-4 rounded-lg bg-red-950/60 px-4 py-3 text-sm text-red-300">{message}</p>
        )}

        <button
          type="button"
          onClick={handleComplete}
          disabled={isPending}
          className="w-full rounded-xl bg-white py-4 text-base font-bold text-black transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? 'Saving…' : 'Complete workout'}
        </button>
      </div>
    </div>
  )
}

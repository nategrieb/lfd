'use client'

import { useState } from 'react'
import { enrollInProgram } from './actions'

type Props = {
  programId: string
  durationWeeks: number
  squatMax: number | null
  benchMax: number | null
  deadliftMax: number | null
}

export default function EnrollForm({ programId, durationWeeks, squatMax, benchMax, deadliftMax }: Props) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Default start date: next Monday
  const nextMonday = () => {
    const d = new Date()
    const day = d.getDay()
    const diff = (8 - day) % 7 || 7
    d.setDate(d.getDate() + diff)
    return d.toISOString().slice(0, 10)
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPending(true)
    setError(null)
    const fd = new FormData(e.currentTarget)
    const result = await enrollInProgram(fd)
    if (result && !result.success) {
      setError(result.message ?? 'An error occurred.')
      setPending(false)
    }
    // On success, the action redirects — no need to reset pending
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <input type="hidden" name="template_id" value={programId} />

      <div>
        <label className="mb-1.5 block text-xs font-semibold text-zinc-300" htmlFor="start_date">
          Start date
        </label>
        <input
          id="start_date"
          name="start_date"
          type="date"
          defaultValue={nextMonday()}
          required
          className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-white focus:border-amber-500 focus:outline-none"
        />
        <p className="mt-1 text-xs text-zinc-500">
          {durationWeeks} weeks · ends ~{(() => {
            const d = new Date(); d.setDate(d.getDate() + durationWeeks * 7); return d.toLocaleDateString()
          })()}
        </p>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">Training Maxes (lbs)</p>
        <p className="mb-3 text-xs text-zinc-400">
          Use ~90% of your true 1RM for best results. Pre-filled from your profile.
        </p>
        <div className="grid grid-cols-3 gap-3">
          {(['squat', 'bench', 'deadlift'] as const).map((lift) => {
            const val = lift === 'squat' ? squatMax : lift === 'bench' ? benchMax : deadliftMax
            return (
              <div key={lift}>
                <label className="mb-1 block text-xs font-medium capitalize text-zinc-400" htmlFor={`${lift}_max`}>
                  {lift}
                </label>
                <input
                  id={`${lift}_max`}
                  name={`${lift}_max`}
                  type="number"
                  min={5}
                  max={2000}
                  step={5}
                  defaultValue={val ?? ''}
                  required
                  placeholder="lbs"
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
                />
              </div>
            )
          })}
        </div>
      </div>

      {error && (
        <p className="rounded-lg bg-rose-500/10 px-4 py-2 text-sm text-rose-300">{error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-amber-500 py-3 text-sm font-bold text-black transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? 'Enrolling…' : 'Start Program'}
      </button>
    </form>
  )
}

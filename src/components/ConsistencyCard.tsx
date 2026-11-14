'use client'

import { useState } from 'react'
import Link from 'next/link'
import WorkoutCalendar, { type WorkoutDate } from '@/components/WorkoutCalendar'
import { TYPE_DOT, cleanTypes } from '@/lib/workout-types'

export type TrainingDay = { id: string; date: string; types: string[] }

const DAY_MS = 86_400_000
const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

/**
 * Consistency at a glance: the last four weeks as a small grid, one mark per workout coloured by its type, so a
 * Push / Pull / Legs rotation reads straight off it. Tap it to open the full calendar.
 */
export default function ConsistencyCard({
  trained,
  calendarDates,
  monthCount,
  monthLabel,
}: {
  trained: TrainingDay[]
  calendarDates: WorkoutDate[]
  monthCount: number
  monthLabel: string
}) {
  const [open, setOpen] = useState(false)

  // Four weeks ending with this week (Monday first), so columns line up with weekdays.
  const now = new Date()
  const todayKey = now.toISOString().slice(0, 10)
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7))
  const start = monday.getTime() - 21 * DAY_MS
  const byDay = new Map<string, TrainingDay>()
  for (const day of trained) if (!byDay.has(day.date.slice(0, 10))) byDay.set(day.date.slice(0, 10), day)
  const cells = Array.from({ length: 28 }, (_, i) => {
    const key = new Date(start + i * DAY_MS).toISOString().slice(0, 10)
    return { key, day: byDay.get(key) ?? null, future: key > todayKey, today: key === todayKey }
  })
  const lastFour = cells.filter((c) => c.day).length

  return (
    <section className="rounded-2xl border border-zinc-100 bg-white p-4 shadow-sm">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center justify-between text-left">
        <span>
          <span className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Consistency</span>
          <span className="block text-sm font-semibold text-zinc-900">
            {lastFour} workout{lastFour === 1 ? '' : 's'} in 4 weeks · {monthCount} in {monthLabel}
          </span>
        </span>
        <svg className={`h-4 w-4 shrink-0 text-zinc-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {!open ? (
        <div className="mt-3">
          <div className="mb-1 grid grid-cols-7 gap-1.5">
            {WEEKDAYS.map((d, i) => (
              <span key={i} className="text-center text-[9px] font-medium uppercase text-zinc-400">
                {d}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {cells.map((cell) => {
              const types = cleanTypes(cell.day?.types)
              const color = cell.day ? (types[0] ? TYPE_DOT[types[0]] : 'bg-zinc-500') : cell.future ? 'bg-zinc-50' : 'bg-zinc-100'
              const mark = <span className={`block h-5 w-full rounded-md ${color} ${cell.today ? 'ring-2 ring-green-600 ring-offset-1' : ''}`} />
              return cell.day ? (
                <Link key={cell.key} href={`/workout/${cell.day.id}/summary`} aria-label={`Workout on ${cell.key}${types.length ? `, ${types.join(' and ')}` : ''}`} title={types.join(' + ') || 'Workout'}>
                  {mark}
                </Link>
              ) : (
                <span key={cell.key}>{mark}</span>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="mt-3">
          <WorkoutCalendar workoutDates={calendarDates} />
        </div>
      )}
    </section>
  )
}

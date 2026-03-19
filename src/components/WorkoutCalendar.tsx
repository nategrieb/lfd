'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export type WorkoutDate = {
  /** ISO date/datetime string, e.g. "2026-03-15T14:00:00Z" */
  date: string
  id: string
  /** Defaults to 'completed'. Use 'planned' for future programming entries. */
  status?: 'completed' | 'planned'
}

export default function WorkoutCalendar({ workoutDates }: { workoutDates: WorkoutDate[] }) {
  const router = useRouter()

  const [current, setCurrent] = useState(() => {
    const d = new Date()
    return { year: d.getFullYear(), month: d.getMonth() }
  })

  const todayKey = new Date().toISOString().substring(0, 10)

  // Build lookup: "YYYY-MM-DD" → WorkoutDate[]
  const lookup = new Map<string, WorkoutDate[]>()
  for (const wd of workoutDates) {
    const key = wd.date.substring(0, 10)
    const existing = lookup.get(key)
    if (existing) existing.push(wd)
    else lookup.set(key, [wd])
  }

  const firstOf = new Date(current.year, current.month, 1)
  const daysInMonth = new Date(current.year, current.month + 1, 0).getDate()
  const startDow = firstOf.getDay() // 0 = Sunday
  const monthLabel = firstOf.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })

  type Cell = { key: string; day: number | null; dateKey: string; workouts: WorkoutDate[] }
  const cells: Cell[] = []

  for (let i = 0; i < startDow; i++) {
    cells.push({ key: `pre-${i}`, day: null, dateKey: '', workouts: [] })
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const mm = String(current.month + 1).padStart(2, '0')
    const dd = String(d).padStart(2, '0')
    const dateKey = `${current.year}-${mm}-${dd}`
    cells.push({ key: dateKey, day: d, dateKey, workouts: lookup.get(dateKey) ?? [] })
  }
  while (cells.length % 7 !== 0) {
    cells.push({ key: `post-${cells.length}`, day: null, dateKey: '', workouts: [] })
  }

  function prevMonth() {
    setCurrent(c => {
      const d = new Date(c.year, c.month - 1)
      return { year: d.getFullYear(), month: d.getMonth() }
    })
  }
  function nextMonth() {
    setCurrent(c => {
      const d = new Date(c.year, c.month + 1)
      return { year: d.getFullYear(), month: d.getMonth() }
    })
  }

  return (
    <div>
      {/* Month navigation */}
      <div className="mb-3 flex items-center justify-between">
        <button
          onClick={prevMonth}
          aria-label="Previous month"
          className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
            <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
          </svg>
        </button>
        <span className="text-sm font-semibold">{monthLabel}</span>
        <button
          onClick={nextMonth}
          aria-label="Next month"
          className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
            <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
          </svg>
        </button>
      </div>

      {/* Weekday headers */}
      <div className="mb-1 grid grid-cols-7">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <div key={i} className="text-center text-[10px] font-medium uppercase tracking-wide text-zinc-600">
            {d}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map(cell => {
          if (cell.day === null) return <div key={cell.key} className="h-9" />

          const isToday = cell.dateKey === todayKey
          const hasCompleted = cell.workouts.some(w => (w.status ?? 'completed') === 'completed')
          const hasPlanned = cell.workouts.some(w => w.status === 'planned')
          const isClickable = cell.workouts.length > 0

          return (
            <button
              key={cell.key}
              type="button"
              disabled={!isClickable}
              aria-label={`${cell.day}${hasCompleted ? ', workout day' : ''}${hasPlanned ? ', planned' : ''}`}
              onClick={() => {
                if (cell.workouts.length === 1) {
                  const wd = cell.workouts[0]
                  if ((wd.status ?? 'completed') === 'planned') {
                    router.push(`/scheduled/${wd.id}`)
                  } else {
                    router.push(`/workout/${wd.id}/summary`)
                  }
                }
                // Multiple workouts on one day: future feature (show picker)
              }}
              className={[
                'relative flex h-9 flex-col items-center justify-center rounded-lg text-sm transition-colors',
                isToday ? 'ring-1 ring-amber-500/60' : '',
                isClickable ? 'cursor-pointer hover:bg-zinc-800' : 'cursor-default',
                hasCompleted && !isToday ? 'bg-amber-500/10' : '',
              ].filter(Boolean).join(' ')}
            >
              <span className={[
                'text-sm leading-none',
                isToday ? 'font-bold text-amber-400' : '',
                !hasCompleted && !hasPlanned && !isToday ? 'text-zinc-600' : 'text-zinc-200',
              ].filter(Boolean).join(' ')}>
                {cell.day}
              </span>
              {(hasCompleted || hasPlanned) && (
                <span className={[
                  'mt-0.5 h-1 w-1 rounded-full',
                  hasCompleted ? 'bg-amber-500' : 'bg-zinc-500',
                ].join(' ')} />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

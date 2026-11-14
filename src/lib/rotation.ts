/**
 * Your rotation: the workout types you cycle through. It can be Push / Pull / Legs, a chest / back / shoulders /
 * arms / legs split, or anything else. There is no fixed order: the suggestion is whichever you did longest ago (or
 * never), and you can pick any of them yourself.
 */
import { cleanTypes, type WorkoutType } from './workout-types'

/** When each type was last done (ISO date of the finished workout), or null if never. */
export type LastByType = Partial<Record<WorkoutType, string | null>>

export const ROTATION_PRESETS: { label: string; types: WorkoutType[] }[] = [
  { label: 'Push / Pull / Legs', types: ['Push', 'Pull', 'Legs'] },
  { label: 'Chest / Back / Shoulders / Arms / Legs', types: ['Chest', 'Back', 'Shoulders', 'Arms', 'Legs'] },
]

/** Longest ago first: types you have never done, then the oldest last-done. Ties keep the standard order. */
export function rotationOrder(types: readonly WorkoutType[], last: LastByType): WorkoutType[] {
  const order = cleanTypes(types)
  return [...order].sort((a, b) => {
    const x = last[a] ?? null
    const y = last[b] ?? null
    if (x === y) return order.indexOf(a) - order.indexOf(b)
    if (x === null) return -1
    if (y === null) return 1
    return x.localeCompare(y)
  })
}

/** Whole days since an ISO date, for "3 days ago". */
export function daysAgo(iso: string | null | undefined): number | null {
  if (!iso) return null
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  return Math.max(0, days)
}

export function agoText(iso: string | null | undefined): string {
  const days = daysAgo(iso)
  return days === null ? 'never' : days === 0 ? 'today' : days === 1 ? '1 day ago' : `${days} days ago`
}

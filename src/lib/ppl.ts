/**
 * The Push / Pull / Legs rotation has no fixed order. Whatever order you train them in, the suggestion is whichever
 * you did longest ago (or never), and you can pick any of the three yourself.
 */
export const ROTATION = ['Push', 'Pull', 'Legs'] as const
export type RotationType = (typeof ROTATION)[number]

export const isRotationType = (value: unknown): value is RotationType => ROTATION.includes(value as RotationType)

/** When each type was last done (ISO date of the finished workout), or null if never. */
export type LastByType = Record<RotationType, string | null>

/** Longest ago first: types you have never done, then the oldest last-done. Ties keep Push, Pull, Legs order. */
export function rotationOrder(last: LastByType): RotationType[] {
  return [...ROTATION].sort((a, b) => {
    const x = last[a]
    const y = last[b]
    if (x === y) return ROTATION.indexOf(a) - ROTATION.indexOf(b)
    if (x === null) return -1
    if (y === null) return 1
    return x.localeCompare(y)
  })
}

/** Whole days since an ISO date, for "3 days ago". */
export function daysAgo(iso: string | null): number | null {
  if (!iso) return null
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  return Math.max(0, days)
}

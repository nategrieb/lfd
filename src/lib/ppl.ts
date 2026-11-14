/**
 * The Push / Pull / Legs rotation has no fixed order. Whatever order you train them in, the next one is whichever
 * you did longest ago (or never). Skip moves to the one after that.
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

/**
 * What is up next, and what Skip would move to. A skip holds until you finish another Push / Pull / Legs workout,
 * after which the order follows what you actually did.
 */
export function pickNext(
  last: LastByType,
  newestAt: string | null,
  skip: { to: string | null; at: string | null } | null,
): { order: RotationType[]; next: RotationType; skipTo: RotationType } {
  const order = rotationOrder(last)
  const skipped = skip?.to && isRotationType(skip.to) && skip.at && (!newestAt || skip.at > newestAt) ? skip.to : null
  const next = skipped ?? order[0]
  const skipTo = order[(order.indexOf(next) + 1) % order.length]
  return { order, next, skipTo }
}

/** Whole days since an ISO date, for "3 days ago". */
export function daysAgo(iso: string | null): number | null {
  if (!iso) return null
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  return Math.max(0, days)
}

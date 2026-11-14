/** The Push / Pull / Legs rotation: no fixed schedule, just "what comes after the one you did last". */
export const ROTATION = ['Push', 'Pull', 'Legs'] as const
export type RotationType = (typeof ROTATION)[number]

export const isRotationType = (value: unknown): value is RotationType => ROTATION.includes(value as RotationType)

export const afterInRotation = (type: RotationType): RotationType => ROTATION[(ROTATION.indexOf(type) + 1) % ROTATION.length]

/** The rotation type a workout counts as (the first of its types that is Push, Pull or Legs). */
export function rotationTypeOf(types: readonly string[] | null | undefined): RotationType | null {
  return (types ?? []).find(isRotationType) ?? null
}

/**
 * What is up next: after your last finished Push / Pull / Legs workout, unless you skipped ahead since then.
 * With no history the rotation starts at Push.
 */
export function nextInRotation(
  last: { type: RotationType; at: string } | null,
  skip: { to: string | null; at: string | null } | null,
): RotationType {
  if (skip?.to && isRotationType(skip.to) && skip.at && (!last || skip.at > last.at)) return skip.to
  return last ? afterInRotation(last.type) : 'Push'
}

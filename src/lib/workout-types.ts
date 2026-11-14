/** The kinds of session you can tag a workout with. Shown as pills on cards and the summary. */
export const WORKOUT_TYPES = ['Push', 'Pull', 'Legs', 'Chest', 'Back', 'Shoulders', 'Arms'] as const
export type WorkoutType = (typeof WORKOUT_TYPES)[number]

/** Classes for the pill of each type: soft colour, so a week of workouts reads at a glance. */
export const TYPE_PILL: Record<WorkoutType, string> = {
  Push: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  Pull: 'bg-sky-50 text-sky-700 ring-sky-200',
  Legs: 'bg-amber-50 text-amber-700 ring-amber-200',
  Chest: 'bg-rose-50 text-rose-700 ring-rose-200',
  Back: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  Shoulders: 'bg-violet-50 text-violet-700 ring-violet-200',
  Arms: 'bg-teal-50 text-teal-700 ring-teal-200',
}

/** Keep only known types, in the standard order, whatever is stored. */
export function cleanTypes(types: readonly string[] | null | undefined): WorkoutType[] {
  const have = new Set(types ?? [])
  return WORKOUT_TYPES.filter((t) => have.has(t))
}

/** Solid colours for the small marks on the training grid. */
export const TYPE_DOT: Record<WorkoutType, string> = {
  Push: 'bg-emerald-500',
  Pull: 'bg-sky-500',
  Legs: 'bg-amber-500',
  Chest: 'bg-rose-500',
  Back: 'bg-indigo-500',
  Shoulders: 'bg-violet-500',
  Arms: 'bg-teal-500',
}

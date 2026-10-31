import { resolveLegacyName } from './legacy-exercise-map'

/**
 * Exercise catalogue helpers. The catalogue lives in the `exercises` table and
 * is seeded from free-exercise-db (see src/scripts/import-exercise-catalogue.ts).
 */

export const EXERCISE_IMAGE_BASE = 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/'

export type CatalogueExercise = {
  id: string
  name: string
  equipment: string | null
  primaryMuscles: string[]
  imageUrl: string | null
}

export function exerciseImageUrl(images: string[] | null | undefined): string | null {
  const first = images?.[0]
  return first ? `${EXERCISE_IMAGE_BASE}${first}` : null
}

type NameRow = { id: string; name: string }

function findByName(rows: NameRow[], name: string): string | null {
  const target = name.trim().toLowerCase()
  return rows.find((row) => row.name.toLowerCase() === target)?.id ?? null
}

/** Catalogue id for an exercise name: exact name first, then the older-name map. */
export function matchExerciseId(rows: NameRow[], exerciseName: string): string | null {
  const legacy = resolveLegacyName(exerciseName)
  return findByName(rows, exerciseName) ?? (legacy ? findByName(rows, legacy) : null)
}

/** Slug used in /lifts/<slug> links — same rule the catalogue import uses for exercises.slug. */
export function plainSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

/**
 * The everyday version of the big lifts, by catalogue name. Used for the quick-add pills
 * and to rank these above their many variations in search results.
 */
export const COMMON_LIFTS = [
  'Barbell Squat',
  'Barbell Bench Press - Medium Grip',
  'Barbell Deadlift',
  'Standing Military Press',
  'Barbell Shoulder Press',
  'Bent Over Barbell Row',
  'Romanian Deadlift',
  'Barbell Incline Bench Press - Medium Grip',
  'Front Barbell Squat',
  'Pullups',
  'Chin-Up',
  'Wide-Grip Lat Pulldown',
  'Barbell Curl',
  'Dumbbell Bench Press',
  'Dumbbell Shoulder Press',
  'Seated Cable Rows',
  'Leg Press',
  'Hack Squat',
  'Leg Extensions',
  'Seated Leg Curl',
  'Standing Calf Raises',
]

export const QUICK_PICKS = [
  { label: 'Squat', name: 'Barbell Squat' },
  { label: 'Bench', name: 'Barbell Bench Press - Medium Grip' },
  { label: 'Deadlift', name: 'Barbell Deadlift' },
]

import type { WorkoutPr } from '@/lib/workout-prs'

export type StravaExercise = { name: string; sets: { weight: number; reps: number }[] }

/** "3 × 10 @ 90 lb" when every set matches, otherwise each set as "90×10, 95×8". Bodyweight shows reps only. */
function setsText(sets: StravaExercise['sets']): string {
  const first = sets[0]
  const same = sets.every((s) => s.weight === first.weight && s.reps === first.reps)
  const load = (weight: number) => (weight > 0 ? ` @ ${weight} lb` : '')
  if (same) return sets.length === 1 ? `${first.reps}${load(first.weight)}` : `${sets.length} × ${first.reps}${load(first.weight)}`
  return sets.map((s) => (s.weight > 0 ? `${s.weight}×${s.reps}` : `${s.reps}`)).join(', ')
}

/**
 * What goes in the Strava activity: the lifts, then a one-line summary and any PRs, and the link last (and once).
 * Strava shows plain text, so it stays simple lines.
 */
export function buildStravaDescription({
  exercises,
  minutes,
  location,
  prs,
  link,
}: {
  exercises: StravaExercise[]
  minutes: number | null
  location: string | null
  prs: WorkoutPr[]
  link: string
}): string {
  const setCount = exercises.reduce((n, e) => n + e.sets.length, 0)
  const summary = [`${exercises.length} exercise${exercises.length === 1 ? '' : 's'}`, `${setCount} set${setCount === 1 ? '' : 's'}`, minutes ? `${minutes} min` : null]
    .filter(Boolean)
    .join(' · ')

  const lines: string[] = exercises.map((e) => `${e.name} · ${setsText(e.sets)}`)
  lines.push('', summary)
  if (location) lines.push(`📍 ${location}`)
  if (prs.length > 0) {
    lines.push('')
    for (const pr of prs.slice(0, 3)) lines.push(`🏆 PR: ${pr.name} ${pr.weight} × ${pr.reps} (est. 1RM ${pr.e1rm})`)
  }
  lines.push('', `Full workout: ${link}`)
  return lines.join('\n')
}

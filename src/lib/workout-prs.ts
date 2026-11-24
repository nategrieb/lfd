import type { SupabaseClient } from '@supabase/supabase-js'
import { epley1RM } from '@/lib/lifts'

// The app's client is bound to the lfd schema, so accept any schema.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = SupabaseClient<any, any, any>

export type WorkoutPr = { name: string; weight: number; reps: number; e1rm: number; previous: number }

type SetLike = { exercise_id?: string | null; exercise_name: string; weight: number; reps: number }

/**
 * PRs in a workout: for each exercise, the best estimated 1RM here against everything that athlete did in earlier
 * finished workouts. The earlier heaviest sets are enough to find the earlier best; an exercise with no earlier
 * sets is not a PR. Biggest jump first.
 */
export async function findWorkoutPrs(supabase: Client, workout: { user_id: string; created_at: string }, strengthSets: SetLike[]): Promise<WorkoutPr[]> {
  const byExercise = new Map<string, { name: string; exerciseId: string | null; best: { weight: number; reps: number; e1rm: number } }>()
  for (const set of strengthSets) {
    const e1rm = epley1RM(set.weight, set.reps)
    if (e1rm === null || set.weight <= 0) continue
    const key = set.exercise_id ?? set.exercise_name
    const current = byExercise.get(key)
    if (!current || e1rm > current.best.e1rm) byExercise.set(key, { name: set.exercise_name, exerciseId: set.exercise_id ?? null, best: { weight: set.weight, reps: set.reps, e1rm } })
  }

  const prs: WorkoutPr[] = []
  await Promise.all(
    [...byExercise.values()].map(async ({ name, exerciseId, best }) => {
      let query = supabase
        .from('sets')
        .select('weight, reps, workout:workouts!inner(created_at, status)')
        .eq('user_id', workout.user_id)
        .eq('workout.status', 'completed')
        .lt('workout.created_at', workout.created_at)
        .gt('weight', 0)
        .order('weight', { ascending: false })
        .limit(60)
      query = exerciseId ? query.eq('exercise_id', exerciseId) : query.eq('exercise_name', name)
      const { data: earlier } = await query
      if (!earlier || earlier.length === 0) return
      const previous = Math.max(0, ...earlier.map((e: { weight: number; reps: number }) => epley1RM(e.weight, e.reps) ?? 0))
      if (best.e1rm > previous) prs.push({ name, weight: best.weight, reps: best.reps, e1rm: best.e1rm, previous })
    }),
  )
  return prs.sort((a, b) => b.e1rm - b.previous - (a.e1rm - a.previous))
}

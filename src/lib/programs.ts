/**
 * Program Builder & Engine utilities.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Weight calculation
// ---------------------------------------------------------------------------

/**
 * Calculate the target weight for a percentage-based set.
 * Rounds to the nearest `roundTo` units (default 5 lbs).
 */
export function getCalculatedWeight(
  user1RM: number,
  percentage: number,
  roundTo = 5,
): number {
  return Math.round((user1RM * percentage) / roundTo) * roundTo
}

// ---------------------------------------------------------------------------
// 1RM resolution
// ---------------------------------------------------------------------------

/** Determine exercise category from its name (heuristic used when DB is unavailable). */
export function categoryFromName(exerciseName: string): 'squat' | 'bench' | 'deadlift' | null {
  const n = exerciseName.toLowerCase()
  if (n.includes('squat')) return 'squat'
  if (n.includes('bench') || n.includes('incline press') || n.includes('overhead press') || n.includes('ohp')) return 'bench'
  if (n.includes('deadlift') || n.includes('sldl') || n.includes('rdl')) return 'deadlift'
  return null
}

/**
 * Return the user's 1RM for a given exercise based on its category or name heuristic.
 * Returns null for accessories that don't map to a stored max.
 */
export function resolveExerciseMax(
  exerciseName: string,
  squatMax: number | null,
  benchMax: number | null,
  deadliftMax: number | null,
  category?: string | null,
): number | null {
  const cat = category ?? categoryFromName(exerciseName)
  if (cat === 'squat')    return squatMax
  if (cat === 'bench')    return benchMax
  if (cat === 'deadlift') return deadliftMax
  return null
}

// ---------------------------------------------------------------------------
// Recalculate future scheduled_sets after a 1RM update
// ---------------------------------------------------------------------------

/**
 * Update `scheduled_sets.calculated_weight` for all _planned_ scheduled workouts
 * in any active enrollment belonging to `userId`, where the exercise maps to `category`.
 *
 * Call this from `updateProfile` whenever squat/bench/deadlift 1RM changes.
 */
export async function recalculateFutureWorkouts(
  userId: string,
  category: 'squat' | 'bench' | 'deadlift',
  newMax: number,
  supabase: SupabaseClient,
): Promise<{ updated: number }> {
  // 1. Get all planned scheduled_workouts for this user
  const { data: sws } = await supabase
    .from('scheduled_workouts')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'planned')

  if (!sws?.length) return { updated: 0 }
  const swIds = sws.map((sw) => sw.id)

  // 2. Fetch scheduled_sets with a percentage for those workouts
  const { data: sets } = await supabase
    .from('scheduled_sets')
    .select('id, exercise_name, percentage')
    .in('scheduled_workout_id', swIds)
    .not('percentage', 'is', null)

  if (!sets?.length) return { updated: 0 }

  // 3. Filter to exercises that match the updated category
  const affected = sets.filter((s) => categoryFromName(s.exercise_name) === category)
  if (!affected.length) return { updated: 0 }

  // 4. Batch update (update each row individually — Supabase JS client doesn't support batch UPDATE)
  let updated = 0
  for (const s of affected) {
    const newWeight = getCalculatedWeight(newMax, s.percentage)
    const { error } = await supabase
      .from('scheduled_sets')
      .update({ calculated_weight: newWeight })
      .eq('id', s.id)
    if (!error) updated++
  }

  return { updated }
}

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

/** Format a tempo string "1.0.1" into a readable label. */
export function formatTempo(tempo: string): string {
  const [down, pause, up] = tempo.split('.')
  return `${down}s · ${pause}s · ${up}s`
}

/** Format rest seconds into a short label. */
export function formatRest(seconds: number): string {
  if (seconds >= 60) {
    const mins = seconds / 60
    return `${mins % 1 === 0 ? mins : mins.toFixed(1)}m rest`
  }
  return `${seconds}s rest`
}


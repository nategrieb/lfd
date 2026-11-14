import type { SupabaseClient } from '@supabase/supabase-js'
import { cleanTypes, type WorkoutType } from '@/lib/workout-types'
import { rotationOrder, type LastByType } from '@/lib/rotation'

// The app's client is bound to the lfd schema, so accept any schema.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = SupabaseClient<any, any, any>

/** Your rotation: the types you chose, when each was last done, and which is suggested next. */
export async function getRotation(supabase: Client, userId: string) {
  const { data: profile } = await supabase.from('profiles').select('rotation').eq('id', userId).maybeSingle()
  const types: WorkoutType[] = cleanTypes((profile as { rotation?: string[] | null } | null)?.rotation)
  const last: LastByType = {}
  if (types.length === 0) return { types, last, next: null as WorkoutType | null }

  const { data: rows } = await supabase
    .from('workouts')
    .select('created_at, workout_types')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .overlaps('workout_types', types)
    .order('created_at', { ascending: false })
    .limit(120)
  for (const type of types) last[type] = null
  for (const row of (rows ?? []) as { created_at: string; workout_types: string[] | null }[]) {
    for (const type of row.workout_types ?? []) {
      if ((types as string[]).includes(type) && last[type as WorkoutType] === null) last[type as WorkoutType] = row.created_at
    }
  }
  return { types, last, next: rotationOrder(types, last)[0] }
}

import type { SupabaseClient } from '@supabase/supabase-js'
import { ROTATION, isRotationType, rotationOrder, type LastByType } from '@/lib/ppl'

// The app's client is bound to the lfd schema, so accept any schema.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = SupabaseClient<any, any, any>

/** The rotation as it stands: when each of Push / Pull / Legs was last done, and which is suggested next. */
export async function currentRotation(supabase: Client, userId: string) {
  const { data: rows } = await supabase
    .from('workouts')
    .select('created_at, workout_types')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .overlaps('workout_types', [...ROTATION])
    .order('created_at', { ascending: false })
    .limit(60)

  const last: LastByType = { Push: null, Pull: null, Legs: null }
  for (const row of (rows ?? []) as { created_at: string; workout_types: string[] | null }[]) {
    for (const type of row.workout_types ?? []) {
      if (isRotationType(type) && last[type] === null) last[type] = row.created_at
    }
  }
  return { last, next: rotationOrder(last)[0] }
}

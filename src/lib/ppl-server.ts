import type { SupabaseClient } from '@supabase/supabase-js'
import { ROTATION, isRotationType, pickNext, type LastByType } from '@/lib/ppl'

// The app's client is bound to the lfd schema, so accept any schema.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = SupabaseClient<any, any, any>

/** The rotation as it stands: when each of Push / Pull / Legs was last done, what is next, and what Skip does. */
export async function currentRotation(supabase: Client, userId: string) {
  const [{ data: rows }, { data: profile }] = await Promise.all([
    supabase
      .from('workouts')
      .select('created_at, workout_types')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .overlaps('workout_types', [...ROTATION])
      .order('created_at', { ascending: false })
      .limit(60),
    supabase.from('profiles').select('ppl_skip_to, ppl_skip_at').eq('id', userId).maybeSingle(),
  ])

  const last: LastByType = { Push: null, Pull: null, Legs: null }
  let newestAt: string | null = null
  for (const row of (rows ?? []) as { created_at: string; workout_types: string[] | null }[]) {
    newestAt ??= row.created_at
    for (const type of row.workout_types ?? []) {
      if (isRotationType(type) && last[type] === null) last[type] = row.created_at
    }
  }
  const skip = profile ? { to: (profile as { ppl_skip_to: string | null }).ppl_skip_to, at: (profile as { ppl_skip_at: string | null }).ppl_skip_at } : null
  return { last, ...pickNext(last, newestAt, skip) }
}

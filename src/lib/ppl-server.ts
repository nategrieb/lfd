import type { SupabaseClient } from '@supabase/supabase-js'
import { nextInRotation, rotationTypeOf, ROTATION } from '@/lib/ppl'

// The app's client is bound to the lfd schema, so accept any schema.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = SupabaseClient<any, any, any>

/** The rotation as it stands: the last finished Push / Pull / Legs workout and what is next. */
export async function currentRotation(supabase: Client, userId: string) {
  const [{ data: lastRow }, { data: profile }] = await Promise.all([
    supabase
      .from('workouts')
      .select('id, created_at, workout_types')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .overlaps('workout_types', [...ROTATION])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from('profiles').select('ppl_skip_to, ppl_skip_at').eq('id', userId).maybeSingle(),
  ])
  const lastType = rotationTypeOf(lastRow?.workout_types as string[] | undefined)
  const last = lastRow && lastType ? { type: lastType, at: lastRow.created_at as string } : null
  const skip = profile ? { to: (profile as { ppl_skip_to: string | null }).ppl_skip_to, at: (profile as { ppl_skip_at: string | null }).ppl_skip_at } : null
  return { last, next: nextInRotation(last, skip) }
}


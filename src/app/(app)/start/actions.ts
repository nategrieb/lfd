'use server'

import { createServerSupabase } from '@/lib/supabase-server'
import { isRotationType, type RotationType } from '@/lib/ppl'
import { currentRotation } from '@/lib/ppl-server'

export async function startFreeWorkout(): Promise<{ id?: string; error?: string }> {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) return { error: 'Not authenticated.' }

  const defaultName = `Workout ${new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })}`

  const { data, error } = await supabase
    .from('workouts')
    .insert({ user_id: user.id, status: 'in_progress', name: defaultName })
    .select('id')
    .single()

  if (error || !data?.id) return { error: error?.message ?? 'Could not create workout.' }
  return { id: data.id }
}

/** "Skip": move the rotation on to the type after the current one. */
export async function skipRotation(): Promise<{ next?: RotationType; error?: string }> {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) return { error: 'Not authenticated.' }

  const { skipTo: to } = await currentRotation(supabase, user.id)
  const { error } = await supabase.from('profiles').update({ ppl_skip_to: to, ppl_skip_at: new Date().toISOString() }).eq('id', user.id)
  if (error) return { error: error.message.includes('ppl_skip') ? 'Run the rotation SQL in Supabase first.' : error.message }
  return { next: to }
}

/**
 * Start the next Push / Pull / Legs session. It is a draft copied from your last one of that type: the workout is
 * tagged with the type and remembers which workout it came from, and the workout screen turns that into
 * ready-to-check sets. Cancel the draft, or delete anything in it, to do your own.
 */
export async function startRotationWorkout(type: string): Promise<{ id?: string; error?: string }> {
  if (!isRotationType(type)) return { error: 'Unknown type.' }
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) return { error: 'Not authenticated.' }

  // The most recent finished workout of this type that has sets in it.
  const { data: candidates } = await supabase
    .from('workouts')
    .select('id, sets(id)')
    .eq('user_id', user.id)
    .eq('status', 'completed')
    .contains('workout_types', [type])
    .order('created_at', { ascending: false })
    .limit(8)
  const source = (candidates ?? []).find((w) => Array.isArray(w.sets) && w.sets.length > 0)

  const name = `${type} · ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
  const { data, error } = await supabase
    .from('workouts')
    .insert({ user_id: user.id, status: 'in_progress', name, workout_types: [type], template_from: source?.id ?? null })
    .select('id')
    .single()
  if (error || !data?.id) return { error: error?.message ?? 'Could not create workout.' }
  return { id: data.id }
}


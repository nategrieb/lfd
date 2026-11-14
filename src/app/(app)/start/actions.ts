'use server'

import { createServerSupabase } from '@/lib/supabase-server'
import { WORKOUT_TYPES, cleanTypes } from '@/lib/workout-types'
import { revalidatePath } from 'next/cache'

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

/**
 * Start a Push / Pull / Legs session. It starts as a copy of your last one of that type: the workout is tagged
 * with the type and remembers which workout it came from, and the workout screen turns that into ready-to-check
 * sets. "Clear all" on the workout screen turns it into a blank one.
 */
export async function startRotationWorkout(type: string): Promise<{ id?: string; error?: string }> {
  if (!(WORKOUT_TYPES as readonly string[]).includes(type)) return { error: 'Unknown type.' }
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


/** Choose the workout types you rotate through (empty to turn the rotation off). */
export async function saveRotation(types: string[]): Promise<{ error?: string }> {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) return { error: 'Not authenticated.' }
  const { error } = await supabase.from('profiles').update({ rotation: cleanTypes(types) }).eq('id', user.id)
  if (error) return { error: error.message.includes('rotation') ? 'Run the rotation SQL in Supabase first.' : error.message }
  revalidatePath('/start')
  revalidatePath('/programs')
  return {}
}

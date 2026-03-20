'use server'

import { createServerSupabase } from '@/lib/supabase-server'

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

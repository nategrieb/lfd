'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createServerSupabase } from '@/lib/supabase-server'

export async function startWorkout() {
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.id) {
    return { success: false, message: 'Not authenticated.' }
  }

  const userId = user.id
  const defaultName = `Workout ${new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })}`

  const { data, error } = await supabase
    .from('workouts')
    .insert({ user_id: userId, status: 'in_progress', name: defaultName })
    .select('id')
    .single()

  if (error || !data?.id) {
    return { success: false, message: error?.message ?? 'Failed to start workout.' }
  }

  return { success: true, id: data.id }
}

export async function addSet(formData: FormData) {
  const workoutId = String(formData.get('workout_id'))
  const exerciseName = String(formData.get('exercise_name'))
  const weight = Number(formData.get('weight'))
  const reps = Number(formData.get('reps'))
  const rpeRaw = formData.get('rpe')
  const rpe = rpeRaw !== null && rpeRaw !== '' ? Number(rpeRaw) : null

  if (!workoutId || !exerciseName || Number.isNaN(weight) || Number.isNaN(reps)) {
    return { success: false, message: 'All fields are required and must be valid.' }
  }

  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.id) {
    return { success: false, message: 'Not authenticated.' }
  }

  const userId = user.id

  // Determine the next set order for this workout
  const { data: lastSet } = await supabase
    .from('sets')
    .select('set_order')
    .eq('workout_id', workoutId)
    .order('set_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const nextOrder = (lastSet?.set_order ?? 0) + 1

  const { data, error } = await supabase
    .from('sets')
    .insert({
      workout_id: workoutId,
      user_id: userId,
      exercise_name: exerciseName,
      weight,
      reps,
      rpe,
      set_order: nextOrder,
    })
    .select('*')
    .single()

  if (error || !data) {
    return { success: false, message: error?.message ?? 'Failed to add set.' }
  }

  revalidatePath(`/workout/${workoutId}`)

  return { success: true, set: data }
}

export async function deleteSet({ setId, workoutId }: { setId: string; workoutId: string }) {
  if (!setId || !workoutId) {
    return { success: false, message: 'Missing set or workout id.' }
  }

  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.id) {
    return { success: false, message: 'Not authenticated.' }
  }

  const { error } = await supabase
    .from('sets')
    .delete()
    .eq('id', setId)
    .eq('user_id', user.id)
    .eq('workout_id', workoutId)

  if (error) {
    return { success: false, message: error.message }
  }

  // Best-effort: delete the associated video clip from Storage.
  // The path is deterministic so no extra DB query is needed.
  await supabase.storage
    .from('workout-videos')
    .remove([`${user.id}/${workoutId}/${setId}.mp4`])
    .catch(() => {}) // non-fatal if the file didn't exist

  revalidatePath(`/workout/${workoutId}`)

  return { success: true }
}

export async function updateWorkoutName({
  workoutId,
  name,
}: {
  workoutId: string
  name: string
}) {
  const trimmedName = name.trim()

  if (!workoutId || !trimmedName) {
    return { success: false, message: 'Workout name is required.' }
  }

  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.id) {
    return { success: false, message: 'Not authenticated.' }
  }

  const { error } = await supabase
    .from('workouts')
    .update({ name: trimmedName })
    .eq('id', workoutId)
    .eq('user_id', user.id)

  if (error) {
    return { success: false, message: error.message }
  }

  revalidatePath(`/workout/${workoutId}`)
  revalidatePath(`/workout/${workoutId}/summary`)
  revalidatePath('/history')
  revalidatePath('/')

  return { success: true, name: trimmedName }
}

export async function updateSet({
  setId,
  workoutId,
  exerciseName,
  weight,
  reps,
  rpe,
}: {
  setId: string
  workoutId: string
  exerciseName: string
  weight: number
  reps: number
  rpe: number | null
}) {
  if (!setId || !workoutId || !exerciseName) {
    return { success: false, message: 'Missing required fields.' }
  }

  if (Number.isNaN(weight) || Number.isNaN(reps) || weight <= 0 || reps <= 0) {
    return { success: false, message: 'Weight and reps must be greater than 0.' }
  }

  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.id) {
    return { success: false, message: 'Not authenticated.' }
  }

  const { data, error } = await supabase
    .from('sets')
    .update({
      exercise_name: exerciseName.trim(),
      weight,
      reps,
      rpe,
    })
    .eq('id', setId)
    .eq('workout_id', workoutId)
    .eq('user_id', user.id)
    .select('id, exercise_name, weight, reps, rpe, created_at')
    .single()

  if (error || !data) {
    return { success: false, message: error?.message ?? 'Unable to update set.' }
  }

  revalidatePath(`/workout/${workoutId}`)
  revalidatePath(`/workout/${workoutId}/summary`)

  return { success: true, set: data }
}

export async function cancelWorkoutDraft({ workoutId }: { workoutId: string }) {
  if (!workoutId) {
    return { success: false, message: 'Missing workout id.' }
  }

  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.id) {
    return { success: false, message: 'Not authenticated.' }
  }

  const { data: existingSet } = await supabase
    .from('sets')
    .select('id')
    .eq('workout_id', workoutId)
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  if (existingSet?.id) {
    return { success: false, message: 'Only empty drafts can be canceled.' }
  }

  const { error } = await supabase
    .from('workouts')
    .delete()
    .eq('id', workoutId)
    .eq('user_id', user.id)
    .eq('status', 'in_progress')

  if (error) {
    return { success: false, message: error.message }
  }

  revalidatePath('/workout')
  revalidatePath('/')
  revalidatePath('/history')

  return { success: true }
}

export async function saveSetVideoUrl({
  setId,
  videoUrl,
}: {
  setId: string
  videoUrl: string
}): Promise<{ success: boolean; message?: string }> {
  if (!setId || !videoUrl) {
    return { success: false, message: 'Missing set id or video URL.' }
  }

  // Validate the URL to prevent SSRF / unexpected protocol injection.
  try {
    const parsed = new URL(videoUrl)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return { success: false, message: 'Invalid video URL.' }
    }
  } catch {
    return { success: false, message: 'Invalid video URL.' }
  }

  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.id) {
    return { success: false, message: 'Not authenticated.' }
  }

  const { error } = await supabase
    .from('sets')
    .update({ video_url: videoUrl })
    .eq('id', setId)
    .eq('user_id', user.id) // ownership check — user can only update their own sets

  if (error) {
    return { success: false, message: error.message }
  }

  return { success: true }
}

export async function finishWorkout(formData: FormData): Promise<void> {
  const workoutId = String(formData.get('workout_id'))

  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.id) {
    throw new Error('Not authenticated.')
  }

  // Mark workout as completed
  const { error } = await supabase
    .from('workouts')
    .update({ status: 'completed' })
    .eq('id', workoutId)
    .eq('user_id', user.id)

  if (error) {
    throw new Error(error.message)
  }

  // Fetch all sets for this workout
  const { data: sets } = await supabase
    .from('sets')
    .select('exercise_name, weight')
    .eq('workout_id', workoutId)

  // Only check for PRs for these exercises
  const PR_EXERCISES = ['Squat', 'Bench', 'Deadlift']
  const maxLifts: Record<string, number> = {}
  for (const ex of PR_EXERCISES) {
    const max = Math.max(
      ...((sets ?? []).filter((s) => s.exercise_name === ex).map((s) => s.weight)),
      0
    )
    if (max > 0) maxLifts[ex] = max
  }

  // Fetch current profile PRs
  const { data: profile } = await supabase
    .from('profiles')
    .select('squat_1rm, bench_1rm, deadlift_1rm')
    .eq('id', user.id)
    .single()

  // Prepare update if new PRs found
  const updates: Record<string, number> = {}
  if (profile) {
    if (maxLifts['Squat'] && maxLifts['Squat'] > (profile.squat_1rm ?? 0)) {
      updates['squat_1rm'] = maxLifts['Squat']
    }
    if (maxLifts['Bench'] && maxLifts['Bench'] > (profile.bench_1rm ?? 0)) {
      updates['bench_1rm'] = maxLifts['Bench']
    }
    if (maxLifts['Deadlift'] && maxLifts['Deadlift'] > (profile.deadlift_1rm ?? 0)) {
      updates['deadlift_1rm'] = maxLifts['Deadlift']
    }
  }

  if (Object.keys(updates).length > 0) {
    await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
  }

  redirect(`/workout/${workoutId}/summary`)
}

export async function deleteWorkout({ workoutId }: { workoutId: string }) {
  if (!workoutId) {
    return { success: false, message: 'Missing workout id.' }
  }

  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.id) {
    return { success: false, message: 'Not authenticated.' }
  }

  // Fetch all sets that have a video so we can clean up Storage.
  // We verify ownership via the workout_id + user_id join on workouts.
  const { data: setsWithVideo } = await supabase
    .from('sets')
    .select('id, video_url')
    .eq('workout_id', workoutId)
    .not('video_url', 'is', null)

  // Delete workout row — assumes DB cascade deletes the sets rows.
  // Ownership check: only delete if user_id matches.
  const { error } = await supabase
    .from('workouts')
    .delete()
    .eq('id', workoutId)
    .eq('user_id', user.id)

  if (error) {
    return { success: false, message: error.message }
  }

  // Best-effort bulk-remove all video files from Storage.
  if (setsWithVideo && setsWithVideo.length > 0) {
    const paths = setsWithVideo.map((s) => `${user.id}/${workoutId}/${s.id}.mp4`)
    await supabase.storage.from('workout-videos').remove(paths)
  }

  revalidatePath('/history')
  revalidatePath('/')

  return { success: true }
}

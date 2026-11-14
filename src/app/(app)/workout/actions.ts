'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createServerSupabase } from '@/lib/supabase-server'
import { resolveLegacyName } from '@/lib/legacy-exercise-map'
import { canonicalName } from '@/lib/lifts'
import { cleanTypes } from '@/lib/workout-types'

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

/**
 * Start a workout from a scheduled (planned) workout.
 * Creates a new workout row, links it to the scheduled_workout, and marks it as started.
 */
export async function startScheduledWorkout(scheduledWorkoutId: string) {
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.id) return { success: false as const, message: 'Not authenticated.' }

  const { data: sw } = await supabase
    .from('scheduled_workouts')
    .select('id, template_workout_id, enrollment_id, status, workout_id, template_workouts(name)')
    .eq('id', scheduledWorkoutId)
    .eq('user_id', user.id)
    .single()

  if (!sw) return { success: false as const, message: 'Scheduled workout not found.' }
  if (sw.status === 'completed') return { success: false as const, message: 'Already completed.' }

  // If it was already started and has a linked workout, just redirect there
  if (sw.status === 'started' && sw.workout_id) {
    return { success: true as const, id: sw.workout_id }
  }

  const dayName = (sw.template_workouts as any)?.name ?? 'Program Workout'

  const { data: workout, error: wErr } = await supabase
    .from('workouts')
    .insert({
      user_id: user.id,
      status: 'in_progress',
      name: dayName,
      scheduled_workout_id: scheduledWorkoutId,
    })
    .select('id')
    .single()

  if (wErr || !workout?.id) return { success: false as const, message: wErr?.message ?? 'Failed to start.' }

  await supabase
    .from('scheduled_workouts')
    .update({ status: 'started', workout_id: workout.id })
    .eq('id', scheduledWorkoutId)

  return { success: true as const, id: workout.id }
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
    .select('sort_order')
    .eq('workout_id', workoutId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const nextOrder = (lastSet?.sort_order ?? 0) + 1

  // Link to the exercise catalogue when the name matches (directly, or via the older-name map);
  // free-text names stay unlinked.
  const catalogueName = resolveLegacyName(exerciseName) ?? exerciseName
  const { data: catalogueRow } = await supabase
    .from('exercises')
    .select('id')
    .ilike('name', catalogueName.trim().replace(/[%_\\]/g, '\\$&'))
    .maybeSingle()

  const { data, error } = await supabase
    .from('sets')
    .insert({
      workout_id: workoutId,
      user_id: userId,
      exercise_name: exerciseName,
      exercise_id: catalogueRow?.id ?? null,
      weight,
      reps,
      rpe,
      sort_order: nextOrder,
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

/**
 * What you did the last time you did this exercise (another workout): its sets in order, so a new session can start
 * from them and you only change what is different. Matches the catalogue exercise first, then the typed name.
 */
export async function getLastSessionSets({ exerciseName, workoutId }: { exerciseName: string; workoutId: string }) {
  if (!exerciseName) return { success: false as const, sets: [] as { weight: number; reps: number; rpe: number | null }[] }

  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.id) return { success: false as const, sets: [] }

  const catalogueName = resolveLegacyName(exerciseName) ?? exerciseName
  const { data: catalogueRow } = await supabase
    .from('exercises')
    .select('id')
    .ilike('name', catalogueName.trim().replace(/[%_\\]/g, '\\$&'))
    .maybeSingle()

  // Find the most recent finished workout that had this exercise, by the workout's own date (imported sets all
  // share one saved-at time, so the sets' own timestamps cannot tell sessions apart).
  async function latestWorkoutId(column: 'exercise_id' | 'exercise_name', value: string): Promise<string | null> {
    const { data } = await supabase
      .from('sets')
      .select('workout_id, workout:workouts!inner(created_at, status)')
      .eq('user_id', user!.id)
      .eq(column, value)
      .neq('workout_id', workoutId)
      .eq('workout.status', 'completed')
      .limit(2000)
    let best: { id: string; at: string } | null = null
    for (const row of (data ?? []) as unknown as { workout_id: string; workout: { created_at: string } | null }[]) {
      const at = row.workout?.created_at ?? ''
      if (!best || at > best.at) best = { id: row.workout_id, at }
    }
    return best?.id ?? null
  }

  let lastWorkout: string | null = null
  let matchColumn: 'exercise_id' | 'exercise_name' = 'exercise_name'
  let matchValue = exerciseName
  if (catalogueRow?.id) {
    lastWorkout = await latestWorkoutId('exercise_id', catalogueRow.id)
    if (lastWorkout) {
      matchColumn = 'exercise_id'
      matchValue = catalogueRow.id
    }
  }
  if (!lastWorkout) lastWorkout = await latestWorkoutId('exercise_name', exerciseName)
  if (!lastWorkout) return { success: true as const, sets: [] as { weight: number; reps: number; rpe: number | null }[] }

  // Its sets in the order they were done (no cardio rows).
  const { data: rows } = await supabase
    .from('sets')
    .select('weight, reps, rpe, created_at, sort_order')
    .eq('user_id', user.id)
    .eq('workout_id', lastWorkout)
    .eq(matchColumn, matchValue)
  const sets = ((rows ?? []) as { weight: number; reps: number; rpe: number | null; created_at: string; sort_order: number | null }[])
    .filter((row) => row.weight > 0 || row.reps > 0)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.created_at.localeCompare(b.created_at))
    .map((row) => ({ weight: Number(row.weight), reps: Number(row.reps), rpe: row.rpe != null ? Number(row.rpe) : null }))

  return { success: true as const, sets }
}

/** Tag a workout with its types (Push, Pull, Legs...). Unknown values are dropped. */
export async function updateWorkoutTypes({ workoutId, types }: { workoutId: string; types: string[] }) {
  if (!workoutId) return { success: false, message: 'Missing workout.' }

  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.id) return { success: false, message: 'Not authenticated.' }

  const clean = cleanTypes(types)
  const { error } = await supabase.from('workouts').update({ workout_types: clean }).eq('id', workoutId).eq('user_id', user.id)
  if (error) {
    return { success: false, message: error.message.includes('workout_types') ? 'Run the workout types SQL in Supabase first.' : error.message }
  }

  revalidatePath(`/workout/${workoutId}`)
  revalidatePath(`/workout/${workoutId}/summary`)
  revalidatePath('/profile')
  revalidatePath('/')
  return { success: true, types: clean }
}

/** Remove an exercise from a workout: deletes every set logged for it (and their video clips). */
export async function deleteExercise({ workoutId, exerciseName }: { workoutId: string; exerciseName: string }) {
  if (!workoutId || !exerciseName) {
    return { success: false, message: 'Missing workout or exercise.' }
  }

  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.id) {
    return { success: false, message: 'Not authenticated.' }
  }

  const { data: rows, error: findError } = await supabase
    .from('sets')
    .select('id')
    .eq('workout_id', workoutId)
    .eq('user_id', user.id)
    .eq('exercise_name', exerciseName)

  if (findError) {
    return { success: false, message: findError.message }
  }

  const ids = (rows ?? []).map((row) => row.id as string)
  if (ids.length > 0) {
    const { error } = await supabase.from('sets').delete().in('id', ids).eq('user_id', user.id).eq('workout_id', workoutId)
    if (error) {
      return { success: false, message: error.message }
    }
    // Best-effort: remove the video clips too.
    await supabase.storage
      .from('workout-videos')
      .remove(ids.map((id) => `${user.id}/${workoutId}/${id}.mp4`))
      .catch(() => {})
  }

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
  revalidatePath('/profile')
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
  revalidatePath('/profile')

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

  // Fetch the old URLs before overwriting so we can delete the orphaned files.
  const { data: existing } = await supabase
    .from('sets')
    .select('video_url, thumbnail_url')
    .eq('id', setId)
    .eq('user_id', user.id)
    .maybeSingle()

  const { error } = await supabase
    .from('sets')
    .update({ video_url: videoUrl })
    .eq('id', setId)
    .eq('user_id', user.id) // ownership check — user can only update their own sets

  if (error) {
    return { success: false, message: error.message }
  }

  // Best-effort: delete the old video + thumbnail files that are now orphaned.
  const storagePrefix = '/storage/v1/object/public/workout-videos/'
  const toDelete: string[] = []
  for (const rawUrl of [existing?.video_url, existing?.thumbnail_url]) {
    if (!rawUrl) continue
    const idx = rawUrl.indexOf(storagePrefix)
    if (idx >= 0) {
      const tail = rawUrl.slice(idx + storagePrefix.length)
      toDelete.push(tail.includes('?') ? tail.slice(0, tail.indexOf('?')) : tail)
    }
  }
  if (toDelete.length > 0) {
    await supabase.storage.from('workout-videos').remove(toDelete).catch(() => {})
  }

  return { success: true }
}

export async function saveSetThumbnailUrl({
  setId,
  thumbnailUrl,
}: {
  setId: string
  thumbnailUrl: string
}): Promise<{ success: boolean; message?: string }> {
  if (!setId || !thumbnailUrl) {
    return { success: false, message: 'Missing set id or thumbnail URL.' }
  }

  try {
    const parsed = new URL(thumbnailUrl)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return { success: false, message: 'Invalid thumbnail URL.' }
    }
  } catch {
    return { success: false, message: 'Invalid thumbnail URL.' }
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
    .update({ thumbnail_url: thumbnailUrl })
    .eq('id', setId)
    .eq('user_id', user.id)

  if (error) {
    return { success: false, message: error.message }
  }

  return { success: true }
}

export async function deleteSetVideoUrl(
  setId: string,
): Promise<{ success: boolean; message?: string }> {
  if (!setId) return { success: false, message: 'Missing set id.' }

  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.id) return { success: false, message: 'Not authenticated.' }

  // Fetch old URLs before nulling so we can clean up Storage.
  const { data: existing } = await supabase
    .from('sets')
    .select('video_url, thumbnail_url')
    .eq('id', setId)
    .eq('user_id', user.id)
    .maybeSingle()

  const { error } = await supabase
    .from('sets')
    .update({ video_url: null, thumbnail_url: null })
    .eq('id', setId)
    .eq('user_id', user.id) // ownership check

  if (error) return { success: false, message: error.message }

  // Best-effort: delete the orphaned video + thumbnail files from Storage.
  const storagePrefix = '/storage/v1/object/public/workout-videos/'
  const toDelete: string[] = []
  for (const rawUrl of [existing?.video_url, existing?.thumbnail_url]) {
    if (!rawUrl) continue
    const idx = rawUrl.indexOf(storagePrefix)
    if (idx >= 0) {
      const tail = rawUrl.slice(idx + storagePrefix.length)
      toDelete.push(tail.includes('?') ? tail.slice(0, tail.indexOf('?')) : tail)
    }
  }
  if (toDelete.length > 0) {
    await supabase.storage.from('workout-videos').remove(toDelete).catch(() => {})
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

  // Mark workout as completed, saving location and post photos
  const location = formData.get('location') ? String(formData.get('location')).trim() : null
  const postPhotos = formData.getAll('post_photos').map(String).filter(Boolean)

  const { error } = await supabase
    .from('workouts')
    .update({
      status: 'completed',
      location: location || null,
      post_photos: postPhotos.length > 0 ? postPhotos : null,
    })
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

  // Only check for PRs for these exercises (canonical name → profile column)
  const CANONICAL_PR_MAP: Record<string, string> = {
    'Back Squat': 'squat_1rm',
    'Bench Press': 'bench_1rm',
    'Deadlift': 'deadlift_1rm',
  }
  const maxLifts: Record<string, number> = {}
  for (const set of (sets ?? []) as { exercise_name: string; weight: number }[]) {
    const cn = canonicalName(set.exercise_name)
    if (cn in CANONICAL_PR_MAP) {
      if ((set.weight ?? 0) > (maxLifts[cn] ?? 0)) maxLifts[cn] = set.weight
    }
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
    if (maxLifts['Back Squat'] && maxLifts['Back Squat'] > (profile.squat_1rm ?? 0)) {
      updates['squat_1rm'] = maxLifts['Back Squat']
    }
    if (maxLifts['Bench Press'] && maxLifts['Bench Press'] > (profile.bench_1rm ?? 0)) {
      updates['bench_1rm'] = maxLifts['Bench Press']
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

  revalidatePath('/', 'layout')
  redirect(`/workout/${workoutId}/summary`)
}

export async function updateWorkoutDetails({
  workoutId,
  location,
  postPhotos,
}: {
  workoutId: string
  location: string | null
  postPhotos: string[]
}): Promise<{ success: boolean; message?: string }> {
  if (!workoutId) return { success: false, message: 'Missing workout id.' }

  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.id) return { success: false, message: 'Not authenticated.' }

  const { error } = await supabase
    .from('workouts')
    .update({
      location: location || null,
      post_photos: postPhotos.length > 0 ? postPhotos : null,
    })
    .eq('id', workoutId)
    .eq('user_id', user.id)

  if (error) return { success: false, message: error.message }

  revalidatePath(`/workout/${workoutId}/summary`)
  return { success: true }
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
    const prefix = '/storage/v1/object/public/workout-videos/'
    const paths = setsWithVideo.map((s) => {
      const raw = s.video_url ?? ''
      const idx = raw.indexOf(prefix)
      if (idx >= 0) {
        const tail = raw.slice(idx + prefix.length)
        const q = tail.indexOf('?')
        return q >= 0 ? tail.slice(0, q) : tail
      }
      // Fallback for legacy deterministic paths.
      return `${user.id}/${workoutId}/${s.id}.mp4`
    })
    await supabase.storage.from('workout-videos').remove(paths)
  }

  revalidatePath('/profile')
  revalidatePath('/')

  return { success: true }
}

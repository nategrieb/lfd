'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabase } from '@/lib/supabase-server'

// ── Token refresh ─────────────────────────────────────────────────────────

async function getFreshAccessToken(userId: string): Promise<string | null> {
  const supabase = await createServerSupabase()

  const { data: profile } = await supabase
    .from('profiles')
    .select('strava_access_token, strava_refresh_token, strava_token_expires_at')
    .eq('id', userId)
    .single()

  if (!profile?.strava_refresh_token) return null

  const expiresAt = profile.strava_token_expires_at
    ? new Date(profile.strava_token_expires_at).getTime()
    : 0
  const bufferMs = 5 * 60 * 1000 // refresh 5 min before expiry

  // Still valid
  if (profile.strava_access_token && expiresAt > Date.now() + bufferMs) {
    return profile.strava_access_token
  }

  // Needs refresh
  const res = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id:     process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      grant_type:    'refresh_token',
      refresh_token: profile.strava_refresh_token,
    }),
    cache: 'no-store',
  })

  if (!res.ok) return null

  const data = await res.json() as {
    access_token: string
    refresh_token: string
    expires_at: number
  }

  await supabase
    .from('profiles')
    .update({
      strava_access_token:    data.access_token,
      strava_refresh_token:   data.refresh_token,
      strava_token_expires_at: new Date(data.expires_at * 1000).toISOString(),
    })
    .eq('id', userId)

  return data.access_token
}

// ── Sync a completed workout to Strava ────────────────────────────────────

export async function syncWorkoutToStrava(
  workoutId: string,
): Promise<{ success: true; stravaId: number } | { error: string }> {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) return { error: 'Not authenticated' }

  const accessToken = await getFreshAccessToken(user.id)
  if (!accessToken) return { error: 'Strava not connected' }

  // Fetch workout (includes location)
  const { data: workout } = await supabase
    .from('workouts')
    .select('id, name, created_at, location')
    .eq('id', workoutId)
    .eq('user_id', user.id)
    .single()

  if (!workout) return { error: 'Workout not found' }

  // Fetch all sets in order — select only columns that always exist
  const { data: sets } = await supabase
    .from('sets')
    .select('exercise_name, weight, reps, rpe')
    .eq('workout_id', workoutId)
    .order('created_at', { ascending: true })

  const allSets = sets ?? []
  const totalVolume = allSets.reduce((acc, s) => acc + s.weight * s.reps, 0)

  // Group sets by exercise, preserving first-appearance order
  const exerciseOrder: string[] = []
  const setsByExercise: Record<string, Array<{ weight: number; reps: number; rpe: number | null }>> = {}
  for (const s of allSets) {
    if (!setsByExercise[s.exercise_name]) {
      exerciseOrder.push(s.exercise_name)
      setsByExercise[s.exercise_name] = []
    }
    setsByExercise[s.exercise_name].push({ weight: s.weight, reps: s.reps, rpe: s.rpe ?? null })
  }

  const setsBlock = exerciseOrder.map((name) => {
    const lines = setsByExercise[name].map((s) => {
      const rpePart = s.rpe != null ? `  (RPE ${s.rpe})` : ''
      return `  ${s.weight} lbs × ${s.reps}${rpePart}`
    })
    return `${name.toUpperCase()}\n${lines.join('\n')}`
  }).join('\n\n')

  const base = process.env.NEXT_PUBLIC_BASE_URL ?? ''
  const shareLink = `${base}/w/${workoutId}`
  const locationPart = workout.location ? `  ·  ${workout.location}` : ''
  const workoutName = workout.name?.trim() || 'Weight Training'

  const description = [
    `🏋 ${workoutName}${locationPart}`,
    '',
    setsBlock,
    '',
    `📊 Total Volume: ${new Intl.NumberFormat('en-US').format(totalVolume)} lbs`,
    '',
    `🔗 Full workout: ${shareLink}`,
  ].join('\n')

  const body = {
    name:             workoutName,
    type:             'WeightTraining',
    sport_type:       'WeightTraining',
    start_date_local: new Date(workout.created_at).toISOString().replace(/\.\d{3}Z$/, 'Z'),
    elapsed_time:     3600,
    description,
  }

  const stravaRes = await fetch('https://www.strava.com/api/v3/activities', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  })

  const msg = await stravaRes.text()

  if (!stravaRes.ok) {
    return { error: `Strava error ${stravaRes.status}: ${msg}` }
  }

  const activity = JSON.parse(msg) as { id: number }
  return { success: true, stravaId: activity.id }
}

// ── Disconnect Strava ─────────────────────────────────────────────────────

export async function disconnectStrava(): Promise<{ error?: string }> {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) return { error: 'Not authenticated' }

  await supabase
    .from('profiles')
    .update({
      strava_athlete_id:      null,
      strava_access_token:    null,
      strava_refresh_token:   null,
      strava_token_expires_at: null,
    })
    .eq('id', user.id)

  revalidatePath('/settings/integrations')
  return {}
}

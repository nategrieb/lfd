'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabase } from '@/lib/supabase-server'

// ── Token refresh ─────────────────────────────────────────────────────────

async function getFreshAccessToken(userId: string, forceRefresh = false): Promise<string | null> {
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
  if (!forceRefresh && profile.strava_access_token && expiresAt > Date.now() + bufferMs) {
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

  let accessToken = await getFreshAccessToken(user.id)
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
  const targetStartMs = new Date(workout.created_at).getTime()
  const targetNameLower = workoutName.trim().toLowerCase()

  const description = [
    `🟩 LFD  ${workoutName}${locationPart}`,
    '',
    `OPEN IN LFD REELS: ${shareLink}`,
    '',
    setsBlock,
    '',
    `TOTAL VOLUME: ${new Intl.NumberFormat('en-US').format(totalVolume)} lbs`,
    '',
    `OPEN IN LFD REELS: ${shareLink}`,
  ].join('\n')

  const body = {
    name:             workoutName,
    type:             'WeightTraining',
    sport_type:       'WeightTraining',
    start_date_local: new Date(workout.created_at).toISOString().replace(/\.\d{3}Z$/, 'Z'),
    elapsed_time:     3600,
    description,
  }

  async function findExistingActivityId(token: string): Promise<number | null> {
    const res = await fetch('https://www.strava.com/api/v3/athlete/activities?per_page=30&page=1', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      cache: 'no-store',
    })

    if (!res.ok) return null

    const activities = await res.json() as Array<{
      id: number
      name?: string
      start_date_local?: string
      sport_type?: string
      type?: string
    }>

    for (const a of activities) {
      const candidateStart = a.start_date_local ? new Date(a.start_date_local).getTime() : NaN
      const sameName = (a.name ?? '').trim().toLowerCase() === targetNameLower
      const sameType = (a.sport_type === 'WeightTraining' || a.type === 'WeightTraining')
      const closeInTime = Number.isFinite(candidateStart) && Math.abs(candidateStart - targetStartMs) <= 3 * 60 * 1000
      if (sameName && sameType && closeInTime) return a.id
    }

    return null
  }

  async function createActivity(token: string) {
    const res = await fetch('https://www.strava.com/api/v3/activities', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    })
    const text = await res.text()
    return { res, text }
  }

  let { res: stravaRes, text: msg } = await createActivity(accessToken)

  // Some tokens can become invalid server-side before local expiry.
  // Retry once with a forced refresh to self-heal without reconnecting.
  if (!stravaRes.ok && (stravaRes.status === 401 || stravaRes.status === 404)) {
    const refreshed = await getFreshAccessToken(user.id, true)
    if (refreshed) {
      accessToken = refreshed
      const retry = await createActivity(accessToken)
      stravaRes = retry.res
      msg = retry.text
    }
  }

  // Strava sometimes returns 409 {"message":"error"} for duplicate/conflict creates.
  // Try to resolve by finding the already-created activity and treat as success.
  if (!stravaRes.ok && stravaRes.status === 409) {
    const existingId = await findExistingActivityId(accessToken)
    if (existingId) return { success: true, stravaId: existingId }
    return { error: 'This workout may already be synced on Strava (duplicate conflict).' }
  }

  if (!stravaRes.ok) return { error: `Strava error ${stravaRes.status}: ${msg}` }

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

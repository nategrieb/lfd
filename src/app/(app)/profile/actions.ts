'use server'

import { createServerSupabase } from '@/lib/supabase-server'
import { recalculateFutureWorkouts } from '@/lib/programs'

export async function signOut() {
  const supabase = await createServerSupabase()
  await supabase.auth.signOut()

  return { success: true }
}

export async function updateProfile(formData: FormData) {
  const squat = Number(formData.get('squat') ?? 0)
  const bench = Number(formData.get('bench') ?? 0)
  const deadlift = Number(formData.get('deadlift') ?? 0)
  const preferredUnit = String(formData.get('preferredUnit') ?? formData.get('preferred_unit') ?? 'lb')
  const rawUsername = String(formData.get('username') ?? '').trim().toLowerCase()
  const displayName = String(formData.get('display_name') ?? '').trim().slice(0, 60)

  if (!['lb', 'kg'].includes(preferredUnit)) {
    return { success: false, message: 'Preferred unit must be lb or kg.' }
  }

  if (Number.isNaN(squat) || Number.isNaN(bench) || Number.isNaN(deadlift)) {
    return { success: false, message: '1RM values must be valid numbers.' }
  }

  if (rawUsername && !/^[a-z0-9_]{3,30}$/.test(rawUsername)) {
    return { success: false, message: 'Username must be 3–30 characters: lowercase letters, numbers, and underscores only.' }
  }

  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.id) {
    return { success: false, message: 'Not authenticated.' }
  }

  const userId = user.id

  const upsertPayload: Record<string, unknown> = {
    id: userId,
    squat_1rm: squat,
    bench_1rm: bench,
    deadlift_1rm: deadlift,
    preferred_unit: preferredUnit,
    display_name: displayName || null,
  }
  if (rawUsername) upsertPayload.username = rawUsername

  const rawAvatarUrl = formData.get('avatar_url')
  if (rawAvatarUrl) upsertPayload.avatar_url = String(rawAvatarUrl).trim()

  const { error } = await supabase
    .from('profiles')
    .upsert(upsertPayload)
    .eq('id', userId)

  if (error) {
    if (error.message.includes('profiles_username_unique_idx') || error.message.includes('unique')) {
      return { success: false, message: 'That username is already taken.' }
    }
    if (error.message.includes('profiles_username_format')) {
      return { success: false, message: 'Username must be 3–30 characters: lowercase letters, numbers, and underscores only.' }
    }
    return { success: false, message: error.message }
  }

  // Recalculate pre-planned workout weights for any active program enrollment
  await Promise.all([
    squat   > 0 ? recalculateFutureWorkouts(userId, 'squat',     squat,    supabase) : null,
    bench   > 0 ? recalculateFutureWorkouts(userId, 'bench',     bench,    supabase) : null,
    deadlift > 0 ? recalculateFutureWorkouts(userId, 'deadlift', deadlift, supabase) : null,
  ])

  return { success: true }
}

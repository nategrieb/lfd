'use server'

import { createServerSupabase } from '@/lib/supabase-server'

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

  if (!['lb', 'kg'].includes(preferredUnit)) {
    return { success: false, message: 'Preferred unit must be lb or kg.' }
  }

  if (Number.isNaN(squat) || Number.isNaN(bench) || Number.isNaN(deadlift)) {
    return { success: false, message: '1RM values must be valid numbers.' }
  }

  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.id) {
    return { success: false, message: 'Not authenticated.' }
  }

  const userId = user.id

  const { error } = await supabase
    .from('profiles')
    .upsert({
      id: userId,
      squat_1rm: squat,
      bench_1rm: bench,
      deadlift_1rm: deadlift,
      preferred_unit: preferredUnit,
    })
    .eq('id', userId)

  if (error) {
    return { success: false, message: error.message }
  }

  return { success: true }
}

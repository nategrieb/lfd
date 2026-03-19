'use server'

import { createServerSupabase } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'

export async function completeOnboarding(formData: FormData) {
  const rawUsername = String(formData.get('username') ?? '').trim().toLowerCase()
  const displayName = String(formData.get('display_name') ?? '').trim().slice(0, 60)

  if (!/^[a-z0-9_]{3,30}$/.test(rawUsername)) {
    return {
      success: false,
      message: 'Username must be 3–30 characters: lowercase letters, numbers, and underscores only.',
    }
  }

  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.id) redirect('/login')

  const { error } = await supabase
    .from('profiles')
    .upsert({
      id: user.id,
      username: rawUsername,
      display_name: displayName || null,
    })
    .eq('id', user.id)

  if (error) {
    if (error.message.includes('profiles_username_unique_idx') || error.message.includes('unique')) {
      return { success: false, message: 'That username is already taken — try another.' }
    }
    if (error.message.includes('profiles_username_format')) {
      return { success: false, message: 'Username must be 3–30 characters: lowercase letters, numbers, and underscores only.' }
    }
    return { success: false, message: error.message }
  }

  redirect('/')
}

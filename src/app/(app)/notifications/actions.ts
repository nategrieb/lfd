'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabase } from '@/lib/supabase-server'

export async function markNotificationsRead() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) return

  await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .is('read_at', null)

  revalidatePath('/notifications')
  revalidatePath('/')
}

'use server'

import { createServerSupabase } from '@/lib/supabase-server'

type ActionResult =
  | { success: true; needsConfirmation?: boolean }
  | { success: false; message: string }

export async function login(formData: FormData): Promise<ActionResult> {
  const email = formData.get('email')?.toString().trim() ?? ''
  const password = formData.get('password')?.toString() ?? ''

  if (!email || !password) {
    return { success: false, message: 'Email and password are required.' }
  }

  const supabase = await createServerSupabase()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) return { success: false, message: error.message }

  return { success: true }
}

export async function signup(formData: FormData): Promise<ActionResult> {
  const email = formData.get('email')?.toString().trim() ?? ''
  const password = formData.get('password')?.toString() ?? ''

  if (!email || !password) {
    return { success: false, message: 'Email and password are required.' }
  }

  const supabase = await createServerSupabase()
  const { data, error } = await supabase.auth.signUp({ email, password })

  if (error) return { success: false, message: error.message }

  // Supabase returns session=null when email confirmation is required.
  // Return a specific flag so the UI can show a "check your email" message.
  if (!data.session) {
    return { success: true, needsConfirmation: true }
  }

  return { success: true }
}

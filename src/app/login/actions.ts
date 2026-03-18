'use server'

import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase-server'

export async function login(formData: FormData) {
  const email = formData.get('email')?.toString().trim() ?? ''
  const password = formData.get('password')?.toString() ?? ''

  if (!email || !password) {
    throw new Error('Email and password are required.')
  }

  const supabase = await createServerSupabase()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) throw new Error(error.message)

  return { success: true }
}

export async function signup(formData: FormData) {
  const email = formData.get('email')?.toString().trim() ?? ''
  const password = formData.get('password')?.toString() ?? ''

  if (!email || !password) {
    throw new Error('Email and password are required.')
  }

  const supabase = await createServerSupabase()
  const { error } = await supabase.auth.signUp({ email, password })

  if (error) throw new Error(error.message)

  return { success: true }
}

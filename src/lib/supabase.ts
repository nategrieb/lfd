import { createBrowserClient } from '@supabase/ssr'
import { authCookieOptions } from './auth-cookie'
import { getSupabasePublishableOrAnonKey, getSupabaseUrl } from './supabase-config'

export const createClient = () =>
  createBrowserClient(
    getSupabaseUrl(),
    getSupabasePublishableOrAnonKey(),
    { cookieOptions: authCookieOptions, db: { schema: 'lfd' } }
  )
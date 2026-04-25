import { createBrowserClient } from '@supabase/ssr'
import { getSupabasePublishableOrAnonKey, getSupabaseUrl } from './supabase-config'

export const createClient = () =>
  createBrowserClient(
    getSupabaseUrl(),
    getSupabasePublishableOrAnonKey(),
    { db: { schema: 'lfd' } }
  )
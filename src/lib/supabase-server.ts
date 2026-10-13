import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { authCookieOptions } from './auth-cookie'
import { getSupabasePublishableOrAnonKey, getSupabaseUrl } from './supabase-config'

export const createServerSupabase = async () => {
  const cookieStore = await cookies()

  return createServerClient(
    getSupabaseUrl(),
    getSupabasePublishableOrAnonKey(),
    {
      db: { schema: 'lfd' },
      cookieOptions: authCookieOptions,
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from a Server Component — safe to ignore.
            // The proxy handles session refresh and sets cookies on the response.
          }
        },
      },
    }
  )
}

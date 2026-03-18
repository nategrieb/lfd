import { createServerClient } from '@supabase/ssr'
import { cookies, headers } from 'next/headers'
import { parse } from 'cookie'

async function buildCookieOptions() {
  const headerStore = await headers()
  const cookieStore = await cookies()

  return {
    get: async (name: string) => {
      const cookieHeader = headerStore.get('cookie') ?? ''
      const parsed = parse(cookieHeader)
      return parsed[name] ?? null
    },
    set: async (name: string, value: string, options?: Record<string, any>) => {
      if (typeof cookieStore.set === 'function') {
        cookieStore.set(name, value, options as any)
      }
    },
    remove: async (name: string, options?: Record<string, any>) => {
      if (typeof cookieStore.delete === 'function') {
        cookieStore.delete(name, options as any)
      } else if (typeof cookieStore.remove === 'function') {
        cookieStore.remove(name, options as any)
      }
    },
  }
}

export const createServerSupabase = async () =>
  createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { cookies: await buildCookieOptions() }
  )

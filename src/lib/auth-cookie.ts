import type { CookieOptionsWithName } from '@supabase/ssr'

/**
 * In production this is ".nategrieb.com", so one sign-in carries to every subdomain
 * (www, food, photos, lfd). Left unset locally and on previews, where cookies stay per-site.
 */
export const authCookieOptions: CookieOptionsWithName | undefined = process.env.NEXT_PUBLIC_AUTH_COOKIE_DOMAIN
  ? { domain: process.env.NEXT_PUBLIC_AUTH_COOKIE_DOMAIN, path: '/', sameSite: 'lax', secure: true }
  : undefined

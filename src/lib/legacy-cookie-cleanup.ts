import { NextResponse, type NextRequest } from 'next/server'

// Host-only flag cookie (no Domain), so each site cleans itself once.
const CLEANED_FLAG = 'sb-host-clean-v1'

/**
 * One-time cleanup after moving to a shared sign-in cookie (.nategrieb.com).
 *
 * A browser can still hold the old per-site copy of the same cookie. When both exist, the
 * app may read the stale one and look signed out (or fail to refresh the session). On the first
 * page visit to each site we delete the old per-site copies (a Set-Cookie with no Domain only
 * touches those; the shared cookie is untouched), then reload the same URL once.
 *
 * Skipped unless the shared-cookie setting is on, for anything that isn't a page load, during the
 * Google sign-in handshake, and once a site has been cleaned.
 */
export function cleanupLegacyAuthCookies(request: NextRequest): NextResponse | null {
  if (!process.env.NEXT_PUBLIC_AUTH_COOKIE_DOMAIN) return null
  if (request.method !== 'GET') return null
  if (!request.headers.get('accept')?.includes('text/html')) return null
  if (request.nextUrl.pathname.startsWith('/auth/') || request.nextUrl.pathname.startsWith('/api/')) return null
  if (request.cookies.has(CLEANED_FLAG)) return null

  const names = request.cookies
    .getAll()
    .map((cookie) => cookie.name)
    .filter((name) => name.startsWith('sb-') && !name.includes('code-verifier'))
  if (names.length === 0) return null

  const response = NextResponse.redirect(request.nextUrl, 307)
  for (const name of names) {
    response.cookies.set(name, '', { path: '/', maxAge: 0 })
  }
  response.cookies.set(CLEANED_FLAG, '1', { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax', secure: true })
  return response
}

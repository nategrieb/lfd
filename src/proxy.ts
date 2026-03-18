import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

function buildCookieOptions(request: NextRequest, response: NextResponse) {
  const requestCookies = request.cookies
  const responseCookies = response.cookies

  return {
    get: (name: string) => {
      const cookie = requestCookies.get(name)
      return cookie ? cookie.value : null
    },
    set: (name: string, value: string, options?: Record<string, any>) => {
      responseCookies.set(name, value, options as any)
    },
    remove: (name: string, options?: Record<string, any>) => {
      if (typeof responseCookies.delete === 'function') {
        responseCookies.delete(name, options as any)
      } else if (typeof responseCookies.remove === 'function') {
        responseCookies.remove(name, options as any)
      }
    },
  }
}

export default async function proxy(request: NextRequest) {
  const response = NextResponse.next()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { cookies: buildCookieOptions(request, response) }
  )

  const {
    data: { session },
  } = await supabase.auth.getSession()

  const isAuthPage = request.nextUrl.pathname.startsWith('/login')

  if (!session && !isAuthPage) {
    const loginUrl = new URL('/login', request.url)
    return NextResponse.redirect(loginUrl)
  }

  if (session && isAuthPage) {
    const profileUrl = new URL('/profile', request.url)
    return NextResponse.redirect(profileUrl)
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
}

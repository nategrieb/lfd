import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'

/** Finishes "Continue with Google": swaps the one-time code for a session cookie, then returns to the app. */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = await createServerSupabase()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // The proxy sends brand-new users without a username on to onboarding.
      return NextResponse.redirect(`${origin}/`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=google`)
}

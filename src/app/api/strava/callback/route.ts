import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'

// GET /api/strava/callback?code=...&state=...
// Strava redirects here after the user authorises the app.
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const code  = searchParams.get('code')
  const error = searchParams.get('error')
  const scope = searchParams.get('scope')

  console.log('[strava/callback] granted scope:', scope)

  const redirectBase = `${process.env.NEXT_PUBLIC_BASE_URL ?? ''}/settings/integrations`

  if (error || !code) {
    return NextResponse.redirect(`${redirectBase}?strava=denied`)
  }

  // Exchange the temporary code for tokens
  const tokenRes = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id:     process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
    }),
  })

  if (!tokenRes.ok) {
    return NextResponse.redirect(`${redirectBase}?strava=error`)
  }

  const token = await tokenRes.json() as {
    access_token:  string
    refresh_token: string
    expires_at:    number
    athlete:       { id: number }
  }

  // Persist tokens against the logged-in user
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_BASE_URL ?? ''}/login`)
  }

  const { error: dbErr } = await supabase
    .from('profiles')
    .update({
      strava_athlete_id:     token.athlete.id,
      strava_access_token:   token.access_token,
      strava_refresh_token:  token.refresh_token,
      strava_token_expires_at: new Date(token.expires_at * 1000).toISOString(),
    })
    .eq('id', user.id)

  if (dbErr) {
    console.error('[strava/callback] db error', dbErr)
    return NextResponse.redirect(`${redirectBase}?strava=error`)
  }

  return NextResponse.redirect(`${redirectBase}?strava=connected`)
}

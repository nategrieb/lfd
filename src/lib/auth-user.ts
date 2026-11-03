import { cache } from 'react'
import { createServerSupabase } from '@/lib/supabase-server'

/**
 * The signed-in user for this request, looked up once however many layouts and pages ask. getClaims checks the
 * session token locally when the project signs tokens with asymmetric keys (no round trip to the auth server),
 * and falls back to asking the server otherwise. The proxy has already validated the session for every request.
 */
export const getAuthUser = cache(async (): Promise<{ id: string; email: string | null } | null> => {
  const supabase = await createServerSupabase()
  const { data } = await supabase.auth.getClaims()
  const claims = data?.claims
  if (!claims?.sub) return null
  return { id: claims.sub, email: (claims.email as string | undefined) ?? null }
})

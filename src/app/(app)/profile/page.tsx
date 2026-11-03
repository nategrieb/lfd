import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase-server'
import { getAuthUser } from '@/lib/auth-user'
import AthleteProfile, { type AthleteRow } from '@/components/AthleteProfile'

/** You: the same landing page everyone else sees when they open your name, plus your shortcuts. */
export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ n?: string }> }) {
  const { n } = await searchParams
  const supabase = await createServerSupabase()
  const user = await getAuthUser()
  if (!user?.id) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, squat_1rm, bench_1rm, deadlift_1rm, preferred_unit')
    .eq('id', user.id)
    .maybeSingle()

  const athlete: AthleteRow = (profile as AthleteRow | null) ?? {
    id: user.id,
    username: null,
    display_name: user.email?.split('@')[0] ?? null,
    avatar_url: null,
    squat_1rm: null,
    bench_1rm: null,
    deadlift_1rm: null,
    preferred_unit: null,
  }

  return <AthleteProfile supabase={supabase} viewerId={user.id} athlete={athlete} feedLimit={Number.parseInt(n ?? '', 10) || undefined} />
}

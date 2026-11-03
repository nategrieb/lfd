import { redirect, notFound } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase-server'
import { getAuthUser } from '@/lib/auth-user'
import AthleteProfile, { type AthleteRow } from '@/components/AthleteProfile'
import BackButton from '@/components/BackButton'

type Props = { params: Promise<{ username: string }>; searchParams: Promise<{ n?: string }> }

export default async function UserProfilePage({ params, searchParams }: Props) {
  const { username } = await params
  const { n } = await searchParams
  const supabase = await createServerSupabase()

  const viewer = await getAuthUser()
  if (!viewer?.id) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, squat_1rm, bench_1rm, deadlift_1rm, preferred_unit')
    .eq('username', username)
    .maybeSingle()

  if (!profile) notFound()
  // Your own page is the one with your shortcuts.
  if (profile.id === viewer.id) redirect('/profile')

  return (
    <div className="relative">
      <div className="absolute left-5 top-8 z-10">
        <BackButton fallback="/search" />
      </div>
      <AthleteProfile supabase={supabase} viewerId={viewer.id} athlete={profile as AthleteRow} feedLimit={Number.parseInt(n ?? '', 10) || undefined} />
    </div>
  )
}

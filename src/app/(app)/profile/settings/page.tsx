import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase-server'
import ProfileForm from '../ProfileForm'
import SignOutButton from '../SignOutButton'

export default async function ProfileSettingsPage() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('username, display_name, squat_1rm, bench_1rm, deadlift_1rm, preferred_unit, avatar_url')
    .eq('id', user.id)
    .maybeSingle()

  const avatarUrl = (profile as any)?.avatar_url ?? null
  const unit = (profile?.preferred_unit as 'lb' | 'kg') ?? 'lb'

  const chevron = (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0 text-zinc-300">
      <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
    </svg>
  )

  return (
    <div className="mx-auto max-w-lg px-4 pb-12 pt-6">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/profile" className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 hover:bg-zinc-200 transition-colors" aria-label="Back">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
          </svg>
        </Link>
        <h1 className="text-lg font-bold text-zinc-900">Settings</h1>
      </div>

      {/* Edit profile */}
      <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Profile</p>
      <div className="mb-6 overflow-hidden rounded-3xl border border-zinc-100 bg-white shadow-sm">
        <div className="px-5 py-5">
          <ProfileForm
            userId={user.id}
            username={profile?.username ?? ''}
            displayName={profile?.display_name ?? ''}
            avatarUrl={avatarUrl}
            squat={profile?.squat_1rm ?? 0}
            bench={profile?.bench_1rm ?? 0}
            deadlift={profile?.deadlift_1rm ?? 0}
            preferredUnit={unit}
          />
        </div>
      </div>

      {/* App links */}
      <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">App</p>
      <div className="mb-6 overflow-hidden rounded-3xl border border-zinc-100 bg-white shadow-sm">
        <Link href="/settings/integrations" className="flex items-center gap-3 px-5 py-4 transition hover:bg-zinc-50">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-zinc-600">
              <path d="M10.75 2.75a.75.75 0 00-1.5 0v8.614L6.295 8.235a.75.75 0 10-1.09 1.03l4.25 4.5a.75.75 0 001.09 0l4.25-4.5a.75.75 0 00-1.09-1.03l-2.955 3.129V2.75z" />
              <path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z" />
            </svg>
          </div>
          <span className="flex-1 text-sm font-medium text-zinc-800">Integrations</span>
          {chevron}
        </Link>
      </div>

      {/* Danger zone */}
      <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Account</p>
      <div className="overflow-hidden rounded-3xl border border-zinc-100 bg-white shadow-sm">
        <div className="flex items-center justify-between px-5 py-4">
          <span className="text-sm font-medium text-red-500">Sign out</span>
          <SignOutButton />
        </div>
      </div>
    </div>
  )
}

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase-server'
import ProfileForm from './ProfileForm'
import SignOutButton from './SignOutButton'

export default async function ProfilePage() {
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.id) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('username, display_name, squat_1rm, bench_1rm, deadlift_1rm, preferred_unit, avatar_url')
    .eq('id', user.id)
    .maybeSingle()

  return (
    <div className="mx-auto max-w-lg px-5 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight">Profile</h1>
        <p className="text-sm text-zinc-400">{user.email}</p>
      </header>

      <section className="rounded-2xl border border-zinc-100 bg-white shadow-sm p-6">
        <h2 className="text-lg font-semibold">Profile</h2>
        <p className="mt-1 text-xs text-zinc-400">Set your name so friends can find you, and update your 1RMs.</p>

        <div className="mt-5">
          <ProfileForm
            userId={user.id}
            username={profile?.username ?? ''}
            displayName={profile?.display_name ?? ''}
            avatarUrl={(profile as any)?.avatar_url ?? null}
            squat={profile?.squat_1rm ?? 0}
            bench={profile?.bench_1rm ?? 0}
            deadlift={profile?.deadlift_1rm ?? 0}
            preferredUnit={(profile?.preferred_unit as 'lb' | 'kg') ?? 'lb'}
          />
        </div>
      </section>

      {/* Integrations */}
      <Link
        href="/settings/integrations"
        className="mt-4 flex items-center justify-between rounded-2xl border border-zinc-100 bg-white shadow-sm p-5 transition hover:border-zinc-200"
      >
        <div>
          <p className="font-semibold">Integrations</p>
          <p className="mt-0.5 text-xs text-zinc-400">Import workouts from Strong and other apps</p>
        </div>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5 shrink-0 text-zinc-500" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
      </Link>

      <div className="mt-6 flex justify-end">
        <SignOutButton />
      </div>
    </div>
  )
}

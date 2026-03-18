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
    .select('username, squat_1rm, bench_1rm, deadlift_1rm, preferred_unit')
    .eq('id', user.id)
    .single()

  return (
    <div className="mx-auto max-w-lg px-5 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight">Profile</h1>
        <p className="text-sm text-zinc-400">{user.email}</p>
      </header>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
        <h2 className="text-lg font-semibold">Lift Stats</h2>
        <p className="mt-1 text-xs text-zinc-400">Update your 1RM and preferred units.</p>

        <div className="mt-5">
          <ProfileForm
            squat={profile?.squat_1rm ?? 0}
            bench={profile?.bench_1rm ?? 0}
            deadlift={profile?.deadlift_1rm ?? 0}
            preferredUnit={(profile?.preferred_unit as 'lb' | 'kg') ?? 'lb'}
          />
        </div>
      </section>

      <div className="mt-6 flex justify-end">
        <SignOutButton />
      </div>
    </div>
  )
}

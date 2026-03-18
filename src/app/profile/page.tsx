import { createServerSupabase } from '@/lib/supabase-server'
import ProfileForm from './ProfileForm'
import SignOutButton from './SignOutButton'

export default async function ProfilePage() {
  const supabase = await createServerSupabase()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const user = session?.user

  const { data: profile } = await supabase
    .from('profiles')
    .select('username, squat_1rm, bench_1rm, deadlift_1rm, preferred_unit')
    .eq('id', user?.id)
    .single()

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-20">
        <header className="flex flex-col gap-2">
          <h1 className="text-4xl font-extrabold tracking-tight">Your profile</h1>
          <p className="text-sm text-zinc-400">Manage your Lift For Dan account.</p>
        </header>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-8 shadow">
          <h2 className="text-xl font-semibold">Lift stats</h2>
          <p className="mt-1 text-sm text-zinc-400">Update your 1RM and preferred units.</p>

          <div className="mt-6">
            <ProfileForm
              squat={profile?.squat_1rm ?? 0}
              bench={profile?.bench_1rm ?? 0}
              deadlift={profile?.deadlift_1rm ?? 0}
              preferredUnit={(profile?.preferred_unit as 'lb' | 'kg') ?? 'lb'}
            />
          </div>

          <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
            <a
              href="/workout"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-500/20 px-5 py-3 text-sm font-semibold text-blue-100 shadow-lg shadow-blue-500/10 transition hover:bg-blue-500/30"
            >
              <span className="text-lg">🏋️</span>
              Start workout
            </a>
            <SignOutButton />
          </div>
        </section>
      </div>
    </main>
  )
}

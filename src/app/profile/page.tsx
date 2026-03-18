import { createServerSupabase } from '@/lib/supabase-server'
import SignOutButton from './SignOutButton'

export default async function ProfilePage() {
  const supabase = await createServerSupabase()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const user = session?.user

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-20">
        <header className="flex flex-col gap-2">
          <h1 className="text-4xl font-extrabold tracking-tight">Your profile</h1>
          <p className="text-sm text-zinc-400">Manage your Lift For Dan account.</p>
        </header>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-8 shadow">
          <h2 className="text-xl font-semibold">Account</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
              <p className="text-xs text-zinc-400">Email</p>
              <p className="mt-1 break-words text-sm font-medium">{user?.email ?? '—'}</p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
              <p className="text-xs text-zinc-400">User ID</p>
              <p className="mt-1 break-words text-sm font-medium">{user?.id ?? '—'}</p>
            </div>
          </div>

          <div className="mt-8">
            <SignOutButton />
          </div>
        </section>
      </div>
    </main>
  )
}

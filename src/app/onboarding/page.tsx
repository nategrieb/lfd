import OnboardingForm from './OnboardingForm'
import { createServerSupabase } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'

export default async function OnboardingPage() {
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.id) redirect('/login')

  // If they already have a username, they don't belong here
  const { data: profile } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.username) redirect('/')

  return (
    <main className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-900 to-zinc-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950/80 p-10 shadow-2xl backdrop-blur">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-extrabold tracking-tight text-white">Welcome to LFD</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Set up your profile so friends can find and follow you.
          </p>
        </div>
        <OnboardingForm />
      </div>
    </main>
  )
}

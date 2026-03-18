import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase-server'
import StartWorkoutButton from './StartWorkoutButton'

export default async function WorkoutIndexPage() {
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.id) {
    redirect('/login')
  }

  const userId = user.id

  const { data: workout } = await supabase
    .from('workouts')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'in_progress')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (workout?.id) {
    redirect(`/workout/${workout.id}`)
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center justify-center gap-8 px-5 py-16">
      <h1 className="text-3xl font-extrabold tracking-tight">Lift For Dan</h1>
      <p className="text-center text-sm text-zinc-400">
        Ready to log today&apos;s workout? Start a new session and track your sets.
      </p>
      <StartWorkoutButton />
    </div>
  )
}

import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase-server'

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
    .maybeSingle()

  if (workout?.id) {
    redirect(`/workout/${workout.id}`)
  }

  const defaultName = `Workout ${new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })}`

  const { data: newWorkout, error } = await supabase
    .from('workouts')
    .insert({ user_id: userId, status: 'in_progress', name: defaultName })
    .select('id')
    .single()

  if (error || !newWorkout?.id) {
    return (
      <div className="mx-auto max-w-lg px-5 py-8">
        <h1 className="text-2xl font-semibold">Could not start workout</h1>
        <p className="mt-2 text-sm text-red-300">{error?.message ?? 'Please try again.'}</p>
      </div>
    )
  }

  redirect(`/workout/${newWorkout.id}`)
}

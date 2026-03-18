import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase-server'
import WorkoutSession from './WorkoutSession'
import { finishWorkout } from '@/app/(app)/workout/actions'

export const dynamic = 'force-dynamic'

export default async function WorkoutPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: workoutId } = await params

  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.id) {
    return null
  }

  const userId = user.id

  const { data: workout } = await supabase
    .from('workouts')
    .select('id, status')
    .eq('id', workoutId)
    .eq('user_id', userId)
    .single()

  if (!workout) {
    redirect('/workout')
  }

  const { data: sets, error: setsError } = await supabase
    .from('sets')
    .select('id, exercise_name, weight, reps, created_at')
    .eq('workout_id', workoutId)
    .order('created_at', { ascending: true })

  if (setsError) {
    return (
      <div className="mx-auto max-w-lg px-5 py-8">
        <h1 className="text-3xl font-semibold">Workout</h1>
        <p className="mt-4 text-sm text-red-400">Error loading sets: {setsError.message}</p>
      </div>
    )
  }

  type WorkoutSet = {
    id: string
    exercise_name: string
    weight: number
    reps: number
    created_at: string
  }

  const setRows = (sets ?? []) as WorkoutSet[]

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6 px-5 py-8">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight">Workout</h1>
        <p className="text-sm text-zinc-400">Log sets for your current session.</p>
      </header>

      <WorkoutSession workoutId={workoutId} initialSets={setRows} />
    </div>
  )
}

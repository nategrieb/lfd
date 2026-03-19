import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase-server'
import WorkoutSession from './WorkoutSession'

export const dynamic = 'force-dynamic'

export default async function WorkoutPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: workoutId } = await params

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
    .select('id, status, name')
    .eq('id', workoutId)
    .eq('user_id', userId)
    .single()

  if (!workout) {
    redirect('/workout')
  }

  const { data: sets, error: setsError } = await supabase
    .from('sets')
    .select('id, exercise_name, weight, reps, rpe, created_at, video_url')
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
    rpe: number | null
    created_at: string
    video_url: string | null
  }

  const setRows = (sets ?? []) as WorkoutSet[]

  // Fetch all user-defined lifts for 1RM lookups (works for any exercise, not just the big 3).
  const { data: liftsData } = await supabase
    .from('lifts')
    .select('name, one_rep_max')
    .eq('user_id', userId)

  const liftOneRepMaxes: Record<string, number> = {}
  for (const lift of liftsData ?? []) {
    if (lift.one_rep_max) liftOneRepMaxes[lift.name.toLowerCase()] = lift.one_rep_max
  }

  // Check if this workout is linked to a scheduled_workout from an active enrollment
  // If so, fetch pre-calculated scheduled_sets for pre-populating the exercise guide.
  const { data: scheduledWorkout } = await supabase
    .from('scheduled_workouts')
    .select('id, template_workout_id, enrollment_id')
    .eq('workout_id', workoutId)
    .eq('user_id', userId)
    .maybeSingle()

  type ScheduledSet = {
    id: string
    sort_order: number
    exercise_name: string
    sets_count: number
    reps: number | null
    reps_note: string | null
    calculated_weight: number | null
    percentage: number | null
    target_rpe: number | null
    tempo: string | null
    rest_seconds: number | null
  }

  let scheduledSets: ScheduledSet[] | undefined

  if (scheduledWorkout?.id) {
    const { data: ssRows } = await supabase
      .from('scheduled_sets')
      .select('id, sort_order, exercise_name, sets_count, reps, reps_note, calculated_weight, percentage, target_rpe, tempo, rest_seconds')
      .eq('scheduled_workout_id', scheduledWorkout.id)
      .order('sort_order')

    if (ssRows?.length) scheduledSets = ssRows as ScheduledSet[]
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6 px-5 py-8">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight">Workout</h1>
        <p className="text-sm text-zinc-400">Log sets and edit this workout live.</p>
      </header>

      <WorkoutSession
        workoutId={workoutId}
        userId={userId}
        initialWorkoutName={workout.name ?? 'Untitled Workout'}
        workoutStatus={workout.status}
        initialSets={setRows}
        liftOneRepMaxes={liftOneRepMaxes}
        scheduledSets={scheduledSets}
      />
    </div>
  )
}

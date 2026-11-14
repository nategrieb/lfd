import { redirect } from 'next/navigation'
import { getAuthUser } from '@/lib/auth-user'
import { createServerSupabase } from '@/lib/supabase-server'
import WorkoutSession from './WorkoutSession'

export const dynamic = 'force-dynamic'

export default async function WorkoutPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: workoutId } = await params

  const supabase = await createServerSupabase()
  const user = await getAuthUser()

  if (!user?.id) {
    redirect('/login')
  }

  const userId = user.id

  const { data: workout } = await supabase
    .from('workouts')
    .select('id, status, name, location, post_photos, workout_types, template_from')
    .eq('id', workoutId)
    .eq('user_id', userId)
    .single()

  if (!workout) {
    redirect('/workout')
  }

  const { data: sets, error: setsError } = await supabase
    .from('sets')
    .select('id, exercise_name, weight, reps, rpe, created_at, video_url, distance_m, duration_seconds')
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

  // A Push / Pull / Legs rotation draft: copy the sets of the earlier workout it came from, as ready-to-check targets.
  let templateLabel: string | undefined
  const templateFrom = (workout as { template_from?: string | null }).template_from
  if (!scheduledSets && templateFrom) {
    const [{ data: source }, { data: sourceSets }] = await Promise.all([
      supabase.from('workouts').select('created_at, workout_types').eq('id', templateFrom).maybeSingle(),
      supabase.from('sets').select('exercise_name, weight, reps, rpe, created_at, sort_order').eq('workout_id', templateFrom).eq('user_id', userId),
    ])
    const ordered = ((sourceSets ?? []) as { exercise_name: string; weight: number; reps: number; rpe: number | null; created_at: string; sort_order: number | null }[])
      .filter((s) => s.weight > 0 || s.reps > 0)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.created_at.localeCompare(b.created_at))
    const built: ScheduledSet[] = []
    for (const exercise of [...new Set(ordered.map((s) => s.exercise_name))]) {
      let previous: ScheduledSet | null = null
      for (const s of ordered.filter((x) => x.exercise_name === exercise)) {
        const weight = s.weight > 0 ? s.weight : null // bodyweight sets have no load to show
        if (previous && previous.calculated_weight === weight && previous.reps === s.reps && previous.target_rpe === s.rpe) {
          previous.sets_count += 1
        } else {
          previous = {
            id: `tpl-${built.length}`,
            sort_order: built.length,
            exercise_name: exercise,
            sets_count: 1,
            reps: s.reps,
            reps_note: null,
            calculated_weight: weight,
            percentage: null,
            target_rpe: s.rpe,
            tempo: null,
            rest_seconds: null,
          }
          built.push(previous)
        }
      }
    }
    if (built.length > 0) {
      scheduledSets = built
      const kind = (source?.workout_types as string[] | undefined)?.find((t) => ['Push', 'Pull', 'Legs'].includes(t)) ?? 'workout'
      templateLabel = `Draft from your last ${kind}, ${new Date(source?.created_at as string).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}`
    }
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
        initialLocation={(workout as any).location ?? null}
        initialPostPhotos={(workout as any).post_photos ?? []}
        initialTypes={(workout as any).workout_types ?? []}
        templateLabel={templateLabel}
      />
    </div>
  )
}

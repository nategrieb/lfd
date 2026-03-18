import { createServerSupabase } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'

export default async function WorkoutSummaryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: workoutId } = await params
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.id) {
    redirect('/login')
  }

  const { data: workout } = await supabase
    .from('workouts')
    .select('id, created_at, status')
    .eq('id', workoutId)
    .eq('user_id', user.id)
    .single()

  if (!workout) {
    redirect('/history')
  }

  const { data: sets } = await supabase
    .from('sets')
    .select('id, exercise_name, weight, reps, created_at')
    .eq('workout_id', workoutId)
    .order('created_at', { ascending: true })

  // Group by exercise
  const grouped = (sets ?? []).reduce((acc: Record<string, any[]>, set) => {
    if (!acc[set.exercise_name]) acc[set.exercise_name] = []
    acc[set.exercise_name].push(set)
    return acc
  }, {})

  // Fetch current profile PRs
  const { data: profile } = await supabase
    .from('profiles')
    .select('squat_1rm, bench_1rm, deadlift_1rm')
    .eq('id', user.id)
    .single()

  // Compute maxes for PR exercises
  const PR_EXERCISES = [
    { name: 'Squat', prKey: 'squat_1rm' },
    { name: 'Bench', prKey: 'bench_1rm' },
    { name: 'Deadlift', prKey: 'deadlift_1rm' },
  ]
  const prBadges: Record<string, boolean> = {}
  for (const { name, prKey } of PR_EXERCISES) {
    const max = Math.max(...((grouped[name] ?? []).map((s: any) => s.weight)), 0)
    if (profile && max > ((profile as any)[prKey] ?? 0)) {
      prBadges[name] = true
    }
  }

  const totalVolume = (sets ?? []).reduce((acc: number, s: { weight: number; reps: number }) => acc + s.weight * s.reps, 0)

  return (
    <div className="mx-auto max-w-lg px-5 py-8">
      <h1 className="text-2xl font-semibold mb-1">Workout Summary</h1>
      <p className="text-sm text-zinc-400 mb-6">{new Date(workout.created_at).toLocaleString()}</p>

      {totalVolume > 0 && (
        <div className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 text-center">
          <p className="text-3xl font-bold">{new Intl.NumberFormat('en-US').format(totalVolume)} lbs</p>
          <p className="text-xs text-zinc-400">Total volume</p>
        </div>
      )}

      {Object.entries(grouped).map(([exercise, exerciseSets]) => (
        <div key={exercise} className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-base font-bold">{exercise}</h2>
            {prBadges[exercise] && (
              <span className="inline-flex items-center gap-1 rounded bg-amber-500/20 px-2 py-0.5 text-xs font-bold text-amber-300">
                🔥 NEW PR
              </span>
            )}
          </div>
          <ul className="space-y-2">
            {exerciseSets.map((set: { id: string; weight: number; reps: number; created_at: string }, i: number) => (
              <li key={set.id} className="flex items-center justify-between rounded-lg bg-zinc-950/40 px-3 py-2 text-sm">
                <span className="text-zinc-400">Set {i + 1}</span>
                <span>{set.weight} lbs x {set.reps}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}

      <div className="mt-8 flex gap-3">
        <a
          href="/history"
          className="flex-1 rounded-xl border border-zinc-700 py-3 text-center text-sm font-semibold text-zinc-200 transition active:bg-zinc-800"
        >
          History
        </a>
        <a
          href="/workout"
          className="flex-1 rounded-xl bg-blue-600 py-3 text-center text-sm font-semibold text-white transition hover:bg-blue-500"
        >
          New Workout
        </a>
      </div>
    </div>
  )
}

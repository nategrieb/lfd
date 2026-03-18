import Link from 'next/link'
import { createServerSupabase } from '@/lib/supabase-server'

export default async function HistoryPage() {
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.id) {
    return (
      <div className="mx-auto max-w-lg px-5 py-8">
        <h1 className="text-2xl font-semibold">History</h1>
        <p className="mt-4 text-sm text-zinc-400">Please sign in to view your workout history.</p>
      </div>
    )
  }

  // Fetch workouts and their exercises
  const { data: workouts, error } = await supabase
    .from('workouts')
    .select('id, created_at, sets(exercise_name)')
    .eq('user_id', user.id)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })

  if (error) {
    return (
      <div className="mx-auto max-w-lg px-5 py-8">
        <h1 className="text-2xl font-semibold">History</h1>
        <p className="mt-4 text-sm text-red-400">Unable to load history: {error.message}</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-lg px-5 py-8">
      <h1 className="text-2xl font-semibold">Workout History</h1>
      <p className="mt-1 text-sm text-zinc-400">Tap a workout to view its sets.</p>

        {workouts?.length ? (
          <ul className="mt-8 space-y-3">
            {workouts.map((workout) => {
              // Get unique exercise names for this workout
              const exerciseNames = Array.from(
                new Set((workout.sets ?? []).map((s: any) => s.exercise_name))
              ).filter(Boolean)
              return (
                <li key={workout.id} className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
                  <Link
                    href={`/workout/${workout.id}/summary`}
                    className="flex items-center justify-between gap-4"
                  >
                    <div>
                      <p className="text-sm font-semibold">Workout</p>
                      <p className="text-xs text-zinc-400">
                        {new Date(workout.created_at).toLocaleString()}
                      </p>
                      <p className="text-xs text-zinc-300 mt-1">
                        {exerciseNames.length ? exerciseNames.join(', ') : 'No exercises'}
                      </p>
                    </div>
                    <span className="text-xs text-emerald-200">View</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="mt-6 text-sm text-zinc-400">No completed workouts yet. Finish a workout to see it here.</p>
        )}
    </div>
  )
}

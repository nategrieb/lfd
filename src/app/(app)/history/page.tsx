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
    .select('id, name, created_at, sets(exercise_name)')
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
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold">{workout.name?.trim() || 'Workout'}</p>
                      <p className="text-xs text-zinc-400">
                        {new Date(workout.created_at).toLocaleString()}
                      </p>
                      <p className="text-xs text-zinc-300 mt-1">
                        {exerciseNames.length ? exerciseNames.join(', ') : 'No exercises'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/workout/${workout.id}`}
                        aria-label="Edit workout"
                        title="Edit workout"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-700 text-zinc-200 hover:bg-zinc-800/60"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          className="h-4 w-4"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M16.862 3.487a2.1 2.1 0 112.97 2.97L9.26 17.03a3 3 0 01-1.265.75l-3.19.91.91-3.19a3 3 0 01.75-1.266L16.862 3.487z"
                          />
                        </svg>
                      </Link>
                      <Link
                        href={`/workout/${workout.id}/summary`}
                        className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500"
                      >
                        View
                      </Link>
                    </div>
                  </div>
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

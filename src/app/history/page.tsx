import Link from 'next/link'
import { createServerSupabase } from '@/lib/supabase-server'

export default async function HistoryPage() {
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.id) {
    return (
      <main className="min-h-screen bg-zinc-950 text-white">
        <div className="mx-auto max-w-3xl px-6 py-20">
          <h1 className="text-3xl font-semibold">History</h1>
          <p className="mt-4 text-sm text-zinc-400">Please sign in to view your workout history.</p>
        </div>
      </main>
    )
  }

  const { data: workouts, error } = await supabase
    .from('workouts')
    .select('id, created_at')
    .eq('user_id', user.id)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })

  if (error) {
    return (
      <main className="min-h-screen bg-zinc-950 text-white">
        <div className="mx-auto max-w-3xl px-6 py-20">
          <h1 className="text-3xl font-semibold">History</h1>
          <p className="mt-4 text-sm text-red-400">Unable to load history: {error.message}</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-3xl px-6 py-20">
        <h1 className="text-3xl font-semibold">Workout history</h1>
        <p className="mt-2 text-sm text-zinc-400">Tap a workout to view its sets.</p>

        {workouts?.length ? (
          <ul className="mt-8 space-y-3">
            {workouts.map((workout) => (
              <li key={workout.id} className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
                <Link
                  href={`/workout/${workout.id}`}
                  className="flex items-center justify-between gap-4"
                >
                  <div>
                    <p className="text-sm font-semibold">Workout</p>
                    <p className="text-xs text-zinc-400">
                      {new Date(workout.created_at).toLocaleString()}
                    </p>
                  </div>
                  <span className="text-xs text-emerald-200">View</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-6 text-sm text-zinc-400">No completed workouts yet. Finish a workout to see it here.</p>
        )}
      </div>
    </main>
  )
}

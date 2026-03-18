import { createServerSupabase } from '@/lib/supabase-server'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import StartWorkoutButton from './workout/StartWorkoutButton'

export default async function DashboardPage() {
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.id) redirect('/login')

  // Fetch profile for 1RM display
  const { data: profile } = await supabase
    .from('profiles')
    .select('squat_1rm, bench_1rm, deadlift_1rm')
    .eq('id', user.id)
    .maybeSingle()

  // Check for in-progress workout
  const { data: activeWorkout } = await supabase
    .from('workouts')
    .select('id')
    .eq('user_id', user.id)
    .eq('status', 'in_progress')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Recent completed workouts
  const { data: recentWorkouts } = await supabase
    .from('workouts')
    .select('id, created_at, sets(exercise_name)')
    .eq('user_id', user.id)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(3)

  const lifts = [
    { label: 'Squat', value: profile?.squat_1rm ?? 0 },
    { label: 'Bench', value: profile?.bench_1rm ?? 0 },
    { label: 'Deadlift', value: profile?.deadlift_1rm ?? 0 },
  ]

  const total = lifts.reduce((sum, l) => sum + l.value, 0)

  return (
    <div className="mx-auto max-w-lg px-5 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight">Lift For Dan</h1>
        <p className="mt-1 text-sm text-zinc-400">
          {user.email}
        </p>
      </div>

      {/* 1RM Cards */}
      <section className="mb-8">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Your 1RMs
        </h2>
        <div className="grid grid-cols-3 gap-3">
          {lifts.map((lift) => (
            <div
              key={lift.label}
              className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 text-center"
            >
              <p className="text-2xl font-bold">{lift.value || '—'}</p>
              <p className="mt-1 text-xs text-zinc-400">{lift.label}</p>
            </div>
          ))}
        </div>
        {total > 0 && (
          <p className="mt-3 text-center text-sm text-zinc-400">
            Total: <span className="font-semibold text-white">{total} lbs</span>
          </p>
        )}
      </section>

      {/* CTA */}
      <section className="mb-8">
        {activeWorkout ? (
          <Link
            href={`/workout/${activeWorkout.id}`}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-4 text-lg font-semibold text-black shadow-lg shadow-orange-500/20 transition hover:brightness-110"
          >
            Continue Workout
          </Link>
        ) : (
          <StartWorkoutButton />
        )}
      </section>

      {/* Recent Workouts */}
      {recentWorkouts && recentWorkouts.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Recent
            </h2>
            <Link href="/history" className="text-xs font-medium text-blue-400">
              View all
            </Link>
          </div>
          <ul className="space-y-2">
            {recentWorkouts.map((w) => {
              const exercises = Array.from(
                new Set((w.sets ?? []).map((s: { exercise_name: string }) => s.exercise_name))
              ).filter(Boolean)

              return (
                <li key={w.id}>
                  <Link
                    href={`/workout/${w.id}/summary`}
                    className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3 transition active:bg-zinc-800/60"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {exercises.length ? exercises.join(', ') : 'Workout'}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {new Date(w.created_at).toLocaleDateString(undefined, {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </p>
                    </div>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      className="h-4 w-4 text-zinc-600"
                    >
                      <path
                        fillRule="evenodd"
                        d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </div>
  )
}

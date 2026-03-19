import { createServerSupabase } from '@/lib/supabase-server'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import StartWorkoutButton from './workout/StartWorkoutButton'
import FeedCard from '@/components/FeedCard'
import { buildFeed, type FeedWorkout } from '@/lib/feed'

export default async function DashboardPage() {
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.id) redirect('/login')

  // Check for in-progress workout (drives the CTA)
  const { data: activeWorkout } = await supabase
    .from('workouts')
    .select('id, name')
    .eq('user_id', user.id)
    .eq('status', 'in_progress')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // 1RM map for scoring — uses the lifts table (generic, any exercise)
  const { data: liftsData } = await supabase
    .from('lifts')
    .select('name, one_rep_max')
    .eq('user_id', user.id)

  const liftsMap: Record<string, number> = {}
  for (const lift of liftsData ?? []) {
    if (lift.one_rep_max) liftsMap[lift.name.toLowerCase()] = lift.one_rep_max
  }

  // Feed source: completed workouts from the last 60 days with all set data.
  // Future: swap `.eq('user_id', user.id)` for `.in('user_id', [userId, ...friendIds])`
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 60)

  const { data: rawWorkouts } = await supabase
    .from('workouts')
    .select('id, name, created_at, user_id, sets(id, exercise_name, weight, reps, rpe, video_url)')
    .eq('user_id', user.id)
    .eq('status', 'completed')
    .gte('created_at', cutoff.toISOString())
    .order('created_at', { ascending: false })
    .limit(30)

  const feedItems = buildFeed((rawWorkouts ?? []) as FeedWorkout[], liftsMap)

  const displayName = user.email?.split('@')[0] ?? 'You'
  const userInitial = (displayName[0] ?? 'U').toUpperCase()

  return (
    <div className="mx-auto max-w-lg px-5 py-8">

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-extrabold tracking-tight">LFD</h1>
        <Link href="/profile" className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-500 text-sm font-bold text-black">
          {userInitial}
        </Link>
      </div>

      {/* ── Workout CTA ────────────────────────────────────────────── */}
      <section className="mb-8">
        {activeWorkout ? (
          <Link
            href={`/workout/${activeWorkout.id}`}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-4 text-lg font-semibold text-black shadow-lg shadow-orange-500/20 transition hover:brightness-110"
          >
            Continue Workout →
          </Link>
        ) : (
          <StartWorkoutButton />
        )}
      </section>

      {/* ── Feed ───────────────────────────────────────────────────── */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Highlights
          </h2>
          <Link href="/history" className="text-xs font-medium text-zinc-400 hover:text-white transition-colors">
            All workouts →
          </Link>
        </div>

        {feedItems.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-700 px-6 py-12 text-center">
            <p className="text-sm font-medium text-zinc-400">No workouts yet.</p>
            <p className="mt-1 text-xs text-zinc-600">Log your first session and it will appear here.</p>
          </div>
        ) : (
          <ul className="space-y-4">
            {feedItems.map((item) => (
              <li key={item.workout.id}>
                <FeedCard
                  item={item}
                  displayName={displayName}
                  userInitial={userInitial}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Spacer so last card clears the bottom nav */}
      <div className="h-4" />
    </div>
  )
}

// ── Dead code removed below — previously the Recent section ──────────────────
// The old recentWorkouts query and JSX list have been replaced by the feed.
// Keeping this comment as a breadcrumb; delete freely.
//
// To restore: git diff HEAD~1 src/app/(app)/page.tsx
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

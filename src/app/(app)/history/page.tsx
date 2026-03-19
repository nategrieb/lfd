import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase-server'
import { buildFeed, type FeedWorkout } from '@/lib/feed'
import { canonicalName } from '@/lib/lifts'
import WorkoutCalendar from '@/components/WorkoutCalendar'
import TodayWorkoutBanner from '@/components/TodayWorkoutBanner'

export default async function YouPage() {
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.id) redirect('/login')

  // All completed workouts with full set data (drives stats + activity list)
  const { data: rawWorkouts } = await supabase
    .from('workouts')
    .select('id, name, created_at, user_id, sets(id, exercise_name, weight, reps, rpe, video_url)')
    .eq('user_id', user.id)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })

  const workouts = (rawWorkouts ?? []) as FeedWorkout[]

  // 1RM map for %1RM badge on each activity row
  const { data: liftsData } = await supabase
    .from('lifts')
    .select('name, one_rep_max')
    .eq('user_id', user.id)

  const liftsMap: Record<string, number> = {}
  for (const lift of liftsData ?? []) {
    if (lift.one_rep_max) liftsMap[lift.name.toLowerCase()] = lift.one_rep_max
  }

  // Stats — computed from workouts already fetched, no extra queries
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const totalSets = workouts.reduce((acc, w) => acc + (w.sets?.length ?? 0), 0)

  // Activity items — algorithm picks best set per workout, then sort chronologically
  const activityItems = buildFeed(workouts, liftsMap).sort(
    (a, b) => new Date(b.workout.created_at).getTime() - new Date(a.workout.created_at).getTime(),
  )

  // "This month" counts only workouts that actually had sets logged (matches activity list)
  const thisMonthCount = activityItems.filter(
    ({ workout: w }) => new Date(w.created_at) >= startOfMonth,
  ).length

  // Planned workouts from active enrollments
  const { data: scheduledWorkouts } = await supabase
    .from('scheduled_workouts')
    .select('id, scheduled_date, template_workout_id')
    .eq('user_id', user.id)
    .eq('status', 'planned')

  // Check for a scheduled workout today
  const todayISO = new Date().toISOString().slice(0, 10)
  const { data: todayScheduled } = await supabase
    .from('scheduled_workouts')
    .select('id, template_workouts(name)')
    .eq('user_id', user.id)
    .eq('scheduled_date', todayISO)
    .in('status', ['planned', 'started'])
    .maybeSingle()

  // Calendar: completed workouts + planned scheduled workouts
  const workoutDates = [
    ...workouts.map(w => ({ date: w.created_at, id: w.id, status: 'completed' as const })),
    ...(scheduledWorkouts ?? []).map(sw => ({
      date: sw.scheduled_date,
      id: sw.id,
      status: 'planned' as const,
    })),
  ]

  // Lifts: count unique canonical exercises across all workouts
  const uniqueExerciseCount = new Set(
    workouts.flatMap(w => w.sets.map(s => canonicalName(s.exercise_name)))
  ).size

  const { data: profileData } = await supabase
    .from('profiles')
    .select('display_name, avatar_url')
    .eq('id', user.id)
    .maybeSingle()

  const displayName = (profileData as any)?.display_name || user.email?.split('@')[0] || 'You'
  const avatarUrl: string | null = (profileData as any)?.avatar_url ?? null
  const userInitial = (displayName[0] ?? 'U').toUpperCase()

  return (
    <div className="mx-auto max-w-lg px-5 py-8">

      {/* ── Header ───────────────────────────────────────────────────── */}
      <div className="mb-6 flex items-center gap-4">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full text-base font-bold text-white"
          style={{ background: 'linear-gradient(135deg, #166534, #16a34a)' }}
        >
          {avatarUrl
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={avatarUrl} alt={displayName} className="h-full w-full object-cover" />
            : userInitial}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{displayName}</p>
          <p className="truncate text-xs text-zinc-500">{user.email}</p>
        </div>
        {/* Integrations */}
        <Link
          href="/settings/integrations"
          aria-label="Integrations"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-zinc-200 text-zinc-500 transition-colors hover:border-zinc-300 hover:text-zinc-700"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
        </Link>

        {/* Settings — links to profile for 1RMs, units, sign-out */}
        <Link
          href="/profile"
          aria-label="Settings"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-zinc-200 text-zinc-500 transition-colors hover:border-zinc-300 hover:text-zinc-700"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.379.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </Link>
      </div>

      {/* ── Stats ─────────────────────────────────────────────────────── */}
      <section className="mb-8 grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-zinc-100 bg-white p-4 text-center shadow-sm">
          <p className="text-2xl font-bold text-zinc-900">{workouts.length}</p>
          <p className="mt-1 text-xs text-zinc-400">Workouts</p>
        </div>
        <div className="rounded-2xl border border-zinc-100 bg-white p-4 text-center shadow-sm">
          <p className="text-2xl font-bold text-zinc-900">{thisMonthCount}</p>
          <p className="mt-1 text-xs text-zinc-400">This month</p>
        </div>
        <div className="rounded-2xl border border-zinc-100 bg-white p-4 text-center shadow-sm">
          <p className="text-2xl font-bold text-zinc-900">{totalSets}</p>
          <p className="mt-1 text-xs text-zinc-400">Total sets</p>
        </div>
      </section>

      {/* ── Calendar ──────────────────────────────────────────────────── */}
      <section className="mb-6 rounded-2xl border border-zinc-100 bg-white p-4 shadow-sm">
        <WorkoutCalendar workoutDates={workoutDates} />
      </section>

      {/* ── Today's scheduled workout ─────────────────────────────────── */}
      {todayScheduled && (
        <TodayWorkoutBanner scheduledId={todayScheduled.id} workoutName={(todayScheduled.template_workouts as any)?.name ?? 'Program Workout'} />
      )}

      {/* ── Programs ──────────────────────────────────────────────────── */}
      <Link
        href="/programs"
        className="mb-3 flex items-center justify-between rounded-2xl border border-zinc-100 bg-white px-5 py-4 shadow-sm transition hover:border-zinc-200"
      >
        <div>
          <p className="font-semibold">Programs</p>
          <p className="mt-0.5 text-xs text-zinc-400">Structured training cycles</p>
        </div>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 shrink-0 text-zinc-500" aria-hidden="true">
          <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
        </svg>
      </Link>

      {/* ── Lifts ─────────────────────────────────────────────────────── */}
      <Link
        href="/lifts"
        className="mb-6 flex items-center justify-between rounded-2xl border border-zinc-100 bg-white px-5 py-4 shadow-sm transition hover:border-zinc-200"
      >
        <div>
          <p className="font-semibold">Lifts</p>
          <p className="mt-0.5 text-xs text-zinc-400">
            {uniqueExerciseCount > 0
              ? `${uniqueExerciseCount} exercise${uniqueExerciseCount !== 1 ? 's' : ''} tracked`
              : 'Track your lift progress'}
          </p>
        </div>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 shrink-0 text-zinc-500" aria-hidden="true">
          <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
        </svg>
      </Link>

      {/* ── Activity list ─────────────────────────────────────────────── */}
      <section>
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Activity
        </h2>

        {activityItems.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-200 px-6 py-12 text-center">
            <p className="text-sm font-medium text-zinc-400">No workouts yet.</p>
            <p className="mt-1 text-xs text-zinc-300">Complete a session and it will appear here.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {activityItems.map(({ workout, highlightSet, pctOneRepMax, extraBadges, videoSet }) => {
              const d = new Date(workout.created_at)
              const weekday = d.toLocaleDateString(undefined, { weekday: 'short' })
              const dateStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
              const title = workout.name?.trim() || highlightSet.exercise_name

              return (
                <li key={workout.id}>
                  <Link
                    href={`/workout/${workout.id}/summary`}
                    className="flex items-center gap-4 rounded-xl border border-zinc-100 bg-white px-4 py-3 shadow-sm transition hover:border-zinc-200"
                  >
                    {/* Date column */}
                    <div className="w-10 shrink-0 text-center">
                      <p className="text-xs text-zinc-500">{weekday}</p>
                      <p className="text-sm font-bold leading-tight">{dateStr.replace(' ', '\u00a0')}</p>
                    </div>

                    {/* Vertical divider */}
                    <div className="w-px self-stretch bg-zinc-100" />

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate text-sm font-semibold">{title}</p>
                        {videoSet && (
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-green-600" title="Has video" />
                        )}
                      </div>
                      <p className="mt-0.5 text-xs font-medium uppercase tracking-wide text-zinc-400">
                        {highlightSet.exercise_name}&nbsp;·&nbsp;{highlightSet.weight}&nbsp;lbs&nbsp;×&nbsp;{highlightSet.reps}&nbsp;reps
                      </p>
                      {(extraBadges.length > 0 || highlightSet.rpe !== null || pctOneRepMax !== null) && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {extraBadges.map((b) => (
                            <span key={b} className="rounded-full px-2 py-0.5 text-xs font-bold text-white" style={{ background: 'linear-gradient(135deg, #166534, #16a34a)' }}>{b}</span>
                          ))}
                          {highlightSet.rpe !== null && (
                            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-600">
                              RPE&nbsp;{highlightSet.rpe}
                            </span>
                          )}
                          {pctOneRepMax !== null && (
                            <span className="rounded-full border border-green-700 px-2 py-0.5 text-xs font-semibold text-green-700">
                              {pctOneRepMax}%&nbsp;1RM
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Chevron */}
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0 text-zinc-600" aria-hidden="true">
                      <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                    </svg>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <div className="h-4" />
    </div>
  )
}

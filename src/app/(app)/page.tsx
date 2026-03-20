import { createServerSupabase } from '@/lib/supabase-server'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import StartWorkoutButton from './workout/StartWorkoutButton'
import TodayWorkoutBanner from '@/components/TodayWorkoutBanner'
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

  // Check for today's scheduled workout from an active program enrollment
  const todayISO = new Date().toISOString().slice(0, 10)
  const { data: todayScheduled } = await supabase
    .from('scheduled_workouts')
    .select('id, template_workouts(name)')
    .eq('user_id', user.id)
    .eq('scheduled_date', todayISO)
    .in('status', ['planned', 'started'])
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

  // Who the current user follows — expands the feed beyond their own workouts
  const { data: followsData } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', user.id)

  const followedIds = (followsData ?? []).map((f) => f.following_id)
  const feedUserIds = [user.id, ...followedIds]

  // Feed source: completed workouts from self + followed users, last 365 days
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 365)

  const { data: rawWorkouts } = await supabase
    .from('workouts')
    .select('id, name, created_at, user_id, post_photos, sets(id, exercise_name, weight, reps, rpe, video_url)')
    .in('user_id', feedUserIds)
    .gte('created_at', cutoff.toISOString())
    .order('created_at', { ascending: false })
    .limit(50)

  const feedItems = buildFeed((rawWorkouts ?? []) as FeedWorkout[], liftsMap)

  // ── Social data for feed cards ────────────────────────────────────────────
  const workoutIds = feedItems.map(item => item.workout.id)

  let jorkRows:     { workout_id: string }[] = []
  let userJorkRows: { workout_id: string }[] = []
  let commentRows:  { workout_id: string }[] = []
  let unreadNotifCount = 0

  const notifCountQuery = supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .is('read_at', null)

  if (workoutIds.length > 0) {
    const [jr, ujr, cr, nc] = await Promise.all([
      supabase.from('workout_jorks').select('workout_id').in('workout_id', workoutIds),
      supabase.from('workout_jorks').select('workout_id').eq('user_id', user.id).in('workout_id', workoutIds),
      supabase.from('workout_comments').select('workout_id').in('workout_id', workoutIds),
      notifCountQuery,
    ])
    jorkRows        = jr.data  ?? []
    userJorkRows    = ujr.data ?? []
    commentRows     = cr.data  ?? []
    unreadNotifCount = nc.count ?? 0
  } else {
    const { count } = await notifCountQuery
    unreadNotifCount = count ?? 0
  }

  const jorkCountMap: Record<string, number> = {}
  for (const j of jorkRows) {
    jorkCountMap[j.workout_id] = (jorkCountMap[j.workout_id] ?? 0) + 1
  }
  const userJorkedSet = new Set(userJorkRows.map(j => j.workout_id))
  const commentCountMap: Record<string, number> = {}
  for (const c of commentRows) {
    commentCountMap[c.workout_id] = (commentCountMap[c.workout_id] ?? 0) + 1
  }

  // Profiles for everyone appearing in the feed (drives avatar + display name per card)
  const { data: profilesData } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url')
    .in('id', feedUserIds)

  const profileMap: Record<string, { name: string; username: string | null; avatarUrl: string | null }> = {}
  for (const p of profilesData ?? []) {
    profileMap[p.id] = {
      name: (p as any).display_name || p.username || '',
      username: p.username ?? null,
      avatarUrl: (p as any).avatar_url ?? null,
    }
  }
  // Fallback for current user
  if (!profileMap[user.id]) {
    profileMap[user.id] = { name: user.email?.split('@')[0] ?? 'You', username: null, avatarUrl: null }
  }

  const currentUserInitial = (profileMap[user.id]?.name?.[0] ?? 'U').toUpperCase()

  return (
    <div className="mx-auto max-w-lg px-5 py-8">

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="mb-6 flex items-center justify-between">
        <div
          className="flex h-8 w-8 items-center justify-center text-xs font-black tracking-widest text-white"
          style={{ background: 'linear-gradient(135deg, #166534, #16a34a)' }}
        >
          LFD
        </div>
        <div className="flex items-center gap-2">
          {/* Notification bell */}
          <Link
            href="/notifications"
            className="relative flex h-9 w-9 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 transition-colors"
            aria-label="Notifications"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
              <path fillRule="evenodd" d="M10 2a6 6 0 00-6 6c0 1.887-.454 3.665-1.257 5.234a.75.75 0 00.515 1.076 32.91 32.91 0 003.256.508 3.5 3.5 0 006.972 0 32.903 32.903 0 003.256-.508.75.75 0 00.515-1.076A11.448 11.448 0 0116 8a6 6 0 00-6-6zM8.05 14.943a33.54 33.54 0 003.9 0 2 2 0 01-3.9 0z" clipRule="evenodd" />
            </svg>
            {unreadNotifCount > 0 && (
              <span
                className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold text-white"
                style={{ background: 'linear-gradient(135deg, #166534, #16a34a)' }}
              >
                {Math.min(unreadNotifCount, 9)}
              </span>
            )}
          </Link>
          {/* Profile avatar */}
          <Link
            href="/profile"
            className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full text-sm font-bold text-white"
            style={{ background: 'linear-gradient(135deg, #166534, #16a34a)' }}
          >
            {profileMap[user.id]?.avatarUrl
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={profileMap[user.id].avatarUrl!} alt="Profile" className="h-full w-full object-cover" />
              : currentUserInitial}
          </Link>
        </div>
      </div>

      {/* ── Workout CTA ────────────────────────────────────────────── */}
      <section className="mb-8">
        {activeWorkout ? (
          <Link
            href={`/workout/${activeWorkout.id}`}
            className="flex w-full items-center justify-center gap-2 rounded-2xl px-6 py-4 text-lg font-semibold text-white shadow-lg transition hover:opacity-90"
            style={{ background: 'linear-gradient(135deg, #166534, #16a34a)' }}
          >
            Continue Workout →
          </Link>
        ) : todayScheduled ? (
          <TodayWorkoutBanner
            scheduledId={todayScheduled.id}
            workoutName={(todayScheduled.template_workouts as any)?.name ?? 'Program Workout'}
          />
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
          <Link href="/history" className="text-xs font-medium text-zinc-400 hover:text-green-700 transition-colors">
            All workouts →
          </Link>
        </div>

        {feedItems.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-200 px-6 py-12 text-center">
            <p className="text-sm font-medium text-zinc-400">No workouts yet.</p>
            <p className="mt-1 text-xs text-zinc-300">Log your first session and it will appear here.</p>
          </div>
        ) : (
          <ul className="space-y-4">
            {feedItems.map((item) => {
              const prof = profileMap[item.workout.user_id]
              const name = prof?.name || item.workout.user_id.slice(0, 8)
              return (
                <li key={item.workout.id}>
                  <FeedCard
                    item={item}
                    displayName={name}
                    userInitial={(name[0] ?? 'U').toUpperCase()}
                    username={prof?.username ?? null}
                    avatarUrl={prof?.avatarUrl ?? null}
                    jorkCount={jorkCountMap[item.workout.id] ?? 0}
                    commentCount={commentCountMap[item.workout.id] ?? 0}
                    hasJorked={userJorkedSet.has(item.workout.id)}
                    currentUserId={user.id}
                  />
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* Spacer so last card clears the bottom nav */}
      <div className="h-4" />
    </div>
  )
}



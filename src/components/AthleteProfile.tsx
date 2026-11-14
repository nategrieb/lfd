import Link from 'next/link'
import { createServerSupabase } from '@/lib/supabase-server'
import { buildFeed, type FeedWorkout } from '@/lib/feed'
import { nameToSlug } from '@/lib/lifts'
import FeedCard from '@/components/FeedCard'
import WorkoutCalendar from '@/components/WorkoutCalendar'
import TodayWorkoutBanner from '@/components/TodayWorkoutBanner'
import ShareLinkButton from '@/components/ShareLinkButton'
import FollowButton from '@/app/(app)/people/FollowButton'

type Client = Awaited<ReturnType<typeof createServerSupabase>>

export type AthleteRow = {
  id: string
  username: string | null
  display_name: string | null
  avatar_url: string | null
  squat_1rm: number | null
  bench_1rm: number | null
  deadlift_1rm: number | null
  preferred_unit: string | null
}

const FEED_PAGE = 15

const chevron = (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden="true">
    <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
  </svg>
)

function NavRow({ href, title, hint }: { href: string; title: string; hint?: string }) {
  return (
    <Link href={href} className="flex items-center justify-between rounded-2xl border border-zinc-100 bg-white px-5 py-4 shadow-sm transition hover:border-zinc-200">
      <div>
        <p className="font-semibold">{title}</p>
        {hint && <p className="mt-0.5 text-xs text-zinc-400">{hint}</p>}
      </div>
      {chevron}
    </Link>
  )
}

/**
 * The landing page for an athlete: who they are, their numbers, their lifts, their training calendar and their
 * recent workouts. The same page for yourself and for anyone who comes to look at your training; only the
 * actions differ (edit and shortcuts for you, follow for everyone else).
 */
export default async function AthleteProfile({
  supabase,
  viewerId,
  athlete,
  feedLimit,
}: {
  supabase: Client
  viewerId: string
  athlete: AthleteRow
  feedLimit?: number
}) {
  const isSelf = athlete.id === viewerId
  const limit = feedLimit && feedLimit > 0 ? feedLimit : FEED_PAGE

  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)
  const yearAgo = new Date()
  yearAgo.setDate(yearAgo.getDate() - 400)
  const todayISO = new Date().toISOString().slice(0, 10)

  const [
    { count: followersCount },
    { count: followingCount },
    { count: workoutCount },
    { count: monthCount },
    { count: setCount },
    { data: enrollment },
    { data: calendarRows },
    { data: rawWorkouts },
    followRow,
    selfExtras,
  ] = await Promise.all([
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', athlete.id),
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', athlete.id),
    supabase.from('workouts').select('*', { count: 'exact', head: true }).eq('user_id', athlete.id).eq('status', 'completed'),
    supabase.from('workouts').select('*', { count: 'exact', head: true }).eq('user_id', athlete.id).eq('status', 'completed').gte('created_at', startOfMonth.toISOString()),
    supabase.from('sets').select('*', { count: 'exact', head: true }).eq('user_id', athlete.id),
    supabase.from('program_enrollments').select('id, program_templates(name)').eq('user_id', athlete.id).eq('status', 'active').maybeSingle(),
    supabase.from('workouts').select('id, created_at').eq('user_id', athlete.id).eq('status', 'completed').gte('created_at', yearAgo.toISOString()),
    supabase
      .from('workouts')
      .select('id, name, created_at, user_id, post_photos, workout_types, sets(id, exercise_name, weight, reps, rpe, video_url, created_at, distance_m, duration_seconds)')
      .eq('user_id', athlete.id)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(limit),
    isSelf
      ? Promise.resolve(null)
      : supabase.from('follows').select('follower_id').eq('follower_id', viewerId).eq('following_id', athlete.id).maybeSingle(),
    isSelf
      ? Promise.all([
          supabase.from('scheduled_workouts').select('id, scheduled_date').eq('user_id', athlete.id).eq('status', 'planned'),
          supabase.from('scheduled_workouts').select('id, template_workouts(name)').eq('user_id', athlete.id).eq('scheduled_date', todayISO).in('status', ['planned', 'started']).maybeSingle(),
          supabase.from('lifts').select('name, one_rep_max').eq('user_id', athlete.id),
          supabase.from('sets').select('exercise_name').eq('user_id', athlete.id).limit(2000),
        ])
      : Promise.resolve(null),
  ])

  const isFollowing = !!(followRow && 'data' in followRow ? followRow.data : null)
  const programName = (enrollment?.program_templates as { name?: string } | null)?.name
  const workouts = (rawWorkouts ?? []) as FeedWorkout[]

  // Self-only: planned sessions on the calendar, today's session, 1RMs for %1RM badges, number of lifts tracked.
  let scheduled: { id: string; scheduled_date: string }[] = []
  let todayScheduled: { id: string; template_workouts: unknown } | null = null
  const liftsMap: Record<string, number> = {}
  let liftsTracked = 0
  if (selfExtras) {
    const [planned, today, lifts, names] = selfExtras
    scheduled = (planned.data ?? []) as typeof scheduled
    todayScheduled = (today.data as typeof todayScheduled) ?? null
    for (const lift of lifts.data ?? []) if (lift.one_rep_max) liftsMap[lift.name.toLowerCase()] = lift.one_rep_max
    liftsTracked = new Set((names.data ?? []).map((r: { exercise_name: string }) => nameToSlug(r.exercise_name))).size
  }

  // Newest first, plainly. (The home feed ranks by highlights; your own page is a log you read in order.)
  const feedItems = buildFeed(workouts, liftsMap).sort((a, b) => b.workout.created_at.localeCompare(a.workout.created_at))
  const calendarDates = [
    ...(calendarRows ?? []).map((w: { id: string; created_at: string }) => ({ date: w.created_at, id: w.id, status: 'completed' as const })),
    ...scheduled.map((sw) => ({ date: sw.scheduled_date, id: sw.id, status: 'planned' as const })),
  ]

  const displayName = athlete.display_name || athlete.username || 'Athlete'
  const initial = (displayName[0] ?? '?').toUpperCase()
  const unit = athlete.preferred_unit ?? 'lb'
  const lifts = [
    { label: 'Squat', value: athlete.squat_1rm ?? 0 },
    { label: 'Bench', value: athlete.bench_1rm ?? 0 },
    { label: 'Deadlift', value: athlete.deadlift_1rm ?? 0 },
  ]
  const total = lifts.reduce((sum, l) => sum + l.value, 0)
  const hasLifts = total > 0
  const liftHref = (label: string) => `/lifts/${nameToSlug(label)}${isSelf ? '' : `?user=${athlete.id}`}`
  const sharePath = athlete.username ? `/people/${athlete.username}` : null

  return (
    <div className="mx-auto max-w-lg px-5 pb-12 pt-8">
      {/* ── Hero ── */}
      <div className="mb-6 flex flex-col items-center text-center">
        <div
          className="mb-3 flex h-20 w-20 items-center justify-center overflow-hidden rounded-full text-2xl font-black text-white shadow-md"
          style={{ background: 'linear-gradient(135deg, #166534, #16a34a)' }}
        >
          {athlete.avatar_url
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={athlete.avatar_url} alt={displayName} className="h-full w-full object-cover" />
            : initial}
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight text-zinc-900">{displayName}</h1>
        {athlete.username && <p className="mt-0.5 text-sm text-zinc-400">@{athlete.username}</p>}

        <div className="mt-4 flex items-center gap-1 text-sm">
          <div className="flex flex-col items-center px-4 py-1.5">
            <span className="text-base font-bold tabular-nums text-zinc-900">{workoutCount ?? 0}</span>
            <span className="text-[11px] text-zinc-400">Workouts</span>
          </div>
          <span className="select-none text-zinc-200">·</span>
          {isSelf ? (
            <Link href="/profile/followers" className="flex flex-col items-center rounded-xl px-4 py-1.5 transition-colors hover:bg-zinc-100">
              <span className="text-base font-bold tabular-nums text-zinc-900">{followersCount ?? 0}</span>
              <span className="text-[11px] text-zinc-400">Followers</span>
            </Link>
          ) : (
            <div className="flex flex-col items-center px-4 py-1.5">
              <span className="text-base font-bold tabular-nums text-zinc-900">{followersCount ?? 0}</span>
              <span className="text-[11px] text-zinc-400">Followers</span>
            </div>
          )}
          <span className="select-none text-zinc-200">·</span>
          {isSelf ? (
            <Link href="/profile/following" className="flex flex-col items-center rounded-xl px-4 py-1.5 transition-colors hover:bg-zinc-100">
              <span className="text-base font-bold tabular-nums text-zinc-900">{followingCount ?? 0}</span>
              <span className="text-[11px] text-zinc-400">Following</span>
            </Link>
          ) : (
            <div className="flex flex-col items-center px-4 py-1.5">
              <span className="text-base font-bold tabular-nums text-zinc-900">{followingCount ?? 0}</span>
              <span className="text-[11px] text-zinc-400">Following</span>
            </div>
          )}
        </div>

        <div className="mt-4 flex items-center gap-2">
          {isSelf ? (
            <Link
              href="/profile/settings"
              className="rounded-xl border border-zinc-200 bg-white px-5 py-2 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-50"
            >
              Edit profile
            </Link>
          ) : (
            <FollowButton userId={athlete.id} initialIsFollowing={isFollowing} />
          )}
          {sharePath && (
            <ShareLinkButton
              path={sharePath}
              title={`${displayName} on LFD`}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-500 transition-colors hover:bg-zinc-50"
            />
          )}
        </div>
      </div>

      {/* ── Today's session (you) / current program ── */}
      {todayScheduled && (
        <TodayWorkoutBanner
          scheduledId={(todayScheduled as { id: string }).id}
          workoutName={((todayScheduled as { template_workouts?: { name?: string } | null }).template_workouts?.name) ?? 'Program Workout'}
        />
      )}
      {programName && (
        <div className="mb-6 flex items-center gap-3 rounded-2xl px-5 py-4" style={{ background: 'linear-gradient(135deg, #166534, #16a34a)' }}>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-green-200">Current program</p>
            <p className="mt-0.5 truncate text-sm font-bold text-white">{programName}</p>
          </div>
          {isSelf && (
            <Link href="/start" className="shrink-0 rounded-xl bg-white/20 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-sm transition-colors hover:bg-white/30">
              Lift →
            </Link>
          )}
        </div>
      )}

      {/* ── Numbers ── */}
      <section className="mb-6 grid grid-cols-3 gap-3">
        {[
          { value: workoutCount ?? 0, label: 'Workouts' },
          { value: monthCount ?? 0, label: 'This month' },
          { value: setCount ?? 0, label: 'Total sets' },
        ].map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-zinc-100 bg-white p-4 text-center shadow-sm">
            <p className="text-2xl font-bold text-zinc-900">{stat.value}</p>
            <p className="mt-1 text-xs text-zinc-400">{stat.label}</p>
          </div>
        ))}
      </section>

      {/* ── Big three ── */}
      {hasLifts && (
        <section className="mb-6">
          <p className="mb-3 px-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">1-Rep Maxes</p>
          <div className="mb-2.5 grid grid-cols-3 gap-2.5">
            {lifts.map(({ label, value }) => (
              <Link
                key={label}
                href={liftHref(label)}
                className="flex flex-col items-center justify-center rounded-2xl border border-zinc-100 bg-white px-3 py-5 shadow-sm transition hover:border-zinc-200"
              >
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">{label}</p>
                <p className="text-2xl font-black leading-none tabular-nums text-zinc-900">{value > 0 ? value : <span className="text-zinc-300">—</span>}</p>
                <p className="mt-1 text-[11px] text-zinc-400">{unit}</p>
              </Link>
            ))}
          </div>
          {lifts.every((l) => l.value > 0) && (
            <div className="rounded-2xl px-7 py-5 shadow-sm" style={{ background: 'linear-gradient(135deg, #166534, #16a34a)' }}>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-green-200">Total</p>
              <p className="mt-0.5 text-4xl font-black leading-none tabular-nums text-white">{total}</p>
              <p className="mt-1 text-[11px] text-green-300">{unit} big three</p>
            </div>
          )}
        </section>
      )}

      {/* ── Calendar ── */}
      <section className="mb-6 rounded-2xl border border-zinc-100 bg-white p-4 shadow-sm">
        <WorkoutCalendar workoutDates={calendarDates} />
      </section>

      {/* ── Your shortcuts ── */}
      {isSelf && (
        <section className="mb-8 space-y-3">
          <NavRow href="/programs" title="Programs" hint="Structured training cycles" />
          <NavRow href="/lifts" title="Lifts" hint={liftsTracked > 0 ? `${liftsTracked} exercise${liftsTracked !== 1 ? 's' : ''} tracked` : 'Track your lift progress'} />
          <NavRow href="/settings/integrations" title="Integrations" hint="Strava, import from Strong" />
          <NavRow href="/profile/settings" title="Settings" hint="1RMs, units, sign out" />
        </section>
      )}

      {/* ── Activity ── */}
      <section>
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-zinc-500">{isSelf ? 'Your activity' : 'Recent workouts'}</h2>
        {feedItems.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-200 px-6 py-12 text-center">
            <p className="text-sm font-medium text-zinc-400">No workouts yet.</p>
            {isSelf && <p className="mt-1 text-xs text-zinc-300">Complete a session and it will appear here.</p>}
          </div>
        ) : (
          <ul className="space-y-4">
            {feedItems.map((item) => (
              <li key={item.workout.id}>
                <FeedCard item={item} displayName={displayName} userInitial={initial} username={athlete.username} avatarUrl={athlete.avatar_url} />
              </li>
            ))}
          </ul>
        )}
        {workouts.length >= limit && (
          <Link
            href={`?n=${limit + FEED_PAGE}`}
            scroll={false}
            className="mt-4 block rounded-xl border border-zinc-200 bg-white py-3 text-center text-sm font-semibold text-zinc-600 transition-colors hover:bg-zinc-50"
          >
            Show more
          </Link>
        )}
      </section>
    </div>
  )
}

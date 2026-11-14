import Link from 'next/link'
import { createServerSupabase } from '@/lib/supabase-server'
import { buildFeed, type FeedWorkout } from '@/lib/feed'
import { nameToSlug } from '@/lib/lifts'
import FeedCard from '@/components/FeedCard'
import ConsistencyCard from '@/components/ConsistencyCard'
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
    supabase.from('program_enrollments').select('id, program_templates(name)').eq('user_id', athlete.id).eq('status', 'active').maybeSingle(),
    supabase.from('workouts').select('id, created_at, workout_types').eq('user_id', athlete.id).eq('status', 'completed').gte('created_at', yearAgo.toISOString()),
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
  if (selfExtras) {
    const [planned, today, lifts] = selfExtras
    scheduled = (planned.data ?? []) as typeof scheduled
    todayScheduled = (today.data as typeof todayScheduled) ?? null
    for (const lift of lifts.data ?? []) if (lift.one_rep_max) liftsMap[lift.name.toLowerCase()] = lift.one_rep_max
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

  const trained = (calendarRows ?? []).map((w: { id: string; created_at: string; workout_types: string[] | null }) => ({
    id: w.id,
    date: w.created_at,
    types: w.workout_types ?? [],
  }))
  const monthLabel = new Date().toLocaleDateString(undefined, { month: 'long' })

  return (
    <div className="mx-auto max-w-lg px-5 pb-12 pt-6">
      {/* ── Who ── */}
      <div className="mb-4 flex items-center gap-3">
        <div
          className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full text-xl font-black text-white shadow-sm"
          style={{ background: 'linear-gradient(135deg, #166534, #16a34a)' }}
        >
          {athlete.avatar_url
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={athlete.avatar_url} alt={displayName} className="h-full w-full object-cover" />
            : initial}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-extrabold tracking-tight text-zinc-900">{displayName}</h1>
          {athlete.username && <p className="truncate text-xs text-zinc-400">@{athlete.username}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {!isSelf && <FollowButton userId={athlete.id} initialIsFollowing={isFollowing} />}
          {sharePath && (
            <ShareLinkButton
              path={sharePath}
              title={`${displayName} on LFD`}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-500 transition-colors hover:bg-zinc-50"
            />
          )}
          {isSelf && (
            <Link
              href="/profile/settings"
              aria-label="Settings"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-500 transition-colors hover:bg-zinc-50"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.379.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </Link>
          )}
        </div>
      </div>

      <div className="mb-4 flex items-center justify-around rounded-2xl border border-zinc-100 bg-white py-2.5 text-center shadow-sm">
        <div><p className="text-base font-bold tabular-nums text-zinc-900">{workoutCount ?? 0}</p><p className="text-[10px] uppercase tracking-wider text-zinc-400">Workouts</p></div>
        {isSelf ? <Link href="/profile/followers" className="rounded-lg px-3"><p className="text-base font-bold tabular-nums text-zinc-900">{followersCount ?? 0}</p><p className="text-[10px] uppercase tracking-wider text-zinc-400">Followers</p></Link> : <div><p className="text-base font-bold tabular-nums text-zinc-900">{followersCount ?? 0}</p><p className="text-[10px] uppercase tracking-wider text-zinc-400">Followers</p></div>}
        {isSelf ? <Link href="/profile/following" className="rounded-lg px-3"><p className="text-base font-bold tabular-nums text-zinc-900">{followingCount ?? 0}</p><p className="text-[10px] uppercase tracking-wider text-zinc-400">Following</p></Link> : <div><p className="text-base font-bold tabular-nums text-zinc-900">{followingCount ?? 0}</p><p className="text-[10px] uppercase tracking-wider text-zinc-400">Following</p></div>}
      </div>

      {/* ── Today's session / current program ── */}
      {todayScheduled && (
        <TodayWorkoutBanner
          scheduledId={(todayScheduled as { id: string }).id}
          workoutName={((todayScheduled as { template_workouts?: { name?: string } | null }).template_workouts?.name) ?? 'Program Workout'}
        />
      )}
      {programName && (
        <div className="mb-4 flex items-center gap-3 rounded-2xl px-4 py-3" style={{ background: 'linear-gradient(135deg, #166534, #16a34a)' }}>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-green-200">Current program</p>
            <p className="truncate text-sm font-bold text-white">{programName}</p>
          </div>
          {isSelf && (
            <Link href="/start" className="shrink-0 rounded-xl bg-white/20 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-sm transition-colors hover:bg-white/30">
              Lift →
            </Link>
          )}
        </div>
      )}

      {/* ── Maxes, one slim row ── */}
      {hasLifts && (
        <section className="mb-4 grid grid-cols-4 divide-x divide-zinc-100 overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-sm">
          {lifts.map(({ label, value }) => (
            <Link key={label} href={liftHref(label)} className="px-2 py-3 text-center transition hover:bg-zinc-50">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">{label}</p>
              <p className="text-lg font-black tabular-nums leading-tight text-zinc-900">{value > 0 ? value : '—'}</p>
            </Link>
          ))}
          <div className="bg-green-50 px-2 py-3 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-green-700">Total</p>
            <p className="text-lg font-black tabular-nums leading-tight text-green-800">{lifts.every((l) => l.value > 0) ? total : '—'}</p>
          </div>
        </section>
      )}

      {/* ── Consistency ── */}
      <div className="mb-6">
        <ConsistencyCard trained={trained} calendarDates={calendarDates} monthCount={monthCount ?? 0} monthLabel={monthLabel} />
      </div>

      {/* ── Activity ── */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">{isSelf ? 'Your activity' : 'Recent workouts'}</h2>
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

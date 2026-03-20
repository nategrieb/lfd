import { createServerSupabase } from '@/lib/supabase-server'
import { redirect, notFound } from 'next/navigation'
import { buildFeed, type FeedWorkout } from '@/lib/feed'
import FeedCard from '@/components/FeedCard'
import FollowButton from '../FollowButton'
import Link from 'next/link'

type Props = { params: Promise<{ username: string }> }

export default async function UserProfilePage({ params }: Props) {
  const { username } = await params
  const supabase = await createServerSupabase()

  const {
    data: { user: viewer },
  } = await supabase.auth.getUser()
  if (!viewer?.id) redirect('/login')

  // Look up the target user by username
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username, display_name, squat_1rm, bench_1rm, deadlift_1rm, preferred_unit, avatar_url')
    .eq('username', username)
    .maybeSingle()

  if (!profile) notFound()

  // Redirect to own profile page if viewing yourself
  if (profile.id === viewer.id) redirect('/profile')

  // Is the viewer already following this user? + social counts + active program
  const [{ data: followRow }, { count: followersCount }, { count: followingCount }, { data: enrollment }] = await Promise.all([
    supabase.from('follows').select('follower_id').eq('follower_id', viewer.id).eq('following_id', profile.id).maybeSingle(),
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', profile.id),
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', profile.id),
    supabase
      .from('program_enrollments')
      .select('id, program_templates(name)')
      .eq('user_id', profile.id)
      .eq('status', 'active')
      .maybeSingle(),
  ])
  const isFollowing = !!followRow
  const programName = (enrollment?.program_templates as any)?.name as string | undefined

  // Fetch their completed workouts for the feed
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 365)

  const { data: rawWorkouts } = await supabase
    .from('workouts')
    .select('id, name, created_at, user_id, post_photos, sets(id, exercise_name, weight, reps, rpe, video_url, created_at, distance_m, duration_seconds)')
    .eq('user_id', profile.id)
    .gte('created_at', cutoff.toISOString())
    .order('created_at', { ascending: false })
    .limit(30)

  const workouts = (rawWorkouts ?? []) as FeedWorkout[]

  // Use an empty liftsMap — we don't have the subject's 1RMs for %1RM scoring,
  // but the feed algorithm degrades gracefully (just skips the %1RM badge).
  const feedItems = buildFeed(workouts, {})

  // Stats — derived from feedItems so counts match what's actually shown
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const totalSets = feedItems.reduce((acc, item) => acc + (item.workout.sets?.length ?? 0), 0)
  const thisMonthCount = feedItems.filter((item) => new Date(item.workout.created_at) >= startOfMonth).length

  const displayName = (profile as any).display_name || profile.username || username
  const initial = (displayName[0] ?? '?').toUpperCase()
  const avatarUrl: string | null = (profile as any).avatar_url ?? null
  const unit = (profile as any).preferred_unit ?? 'lb'

  // Big-three 1RMs — only show if set
  type OneRM = { label: string; value: number }
  const orms: OneRM[] = [
    { label: 'Squat', value: (profile as any).squat_1rm ?? 0 },
    { label: 'Bench', value: (profile as any).bench_1rm ?? 0 },
    { label: 'Deadlift', value: (profile as any).deadlift_1rm ?? 0 },
  ].filter((x) => x.value > 0)

  return (
    <div className="mx-auto max-w-lg px-5 py-8">

      {/* Back */}
      <Link
        href="/people"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-700 transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
          <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
        </svg>
        People
      </Link>

      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full text-xl font-bold text-white" style={{ background: 'linear-gradient(135deg, #166534, #16a34a)' }}>
          {avatarUrl
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={avatarUrl} alt={displayName} className="h-full w-full object-cover" />
            : initial}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xl font-extrabold tracking-tight">{displayName}</p>
          {profile.username && (
            <p className="text-sm text-zinc-500">@{profile.username}</p>
          )}
          <p className="mt-0.5 text-xs text-zinc-400">
            <span className="font-semibold text-zinc-700">{followersCount ?? 0}</span> followers
            {' · '}
            <span className="font-semibold text-zinc-700">{followingCount ?? 0}</span> following
          </p>
        </div>
        <FollowButton userId={profile.id} initialIsFollowing={isFollowing} />
      </div>

      {/* Stats */}
      <section className="mb-8 grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-zinc-100 bg-white shadow-sm p-4 text-center">
          <p className="text-2xl font-bold text-zinc-900">{feedItems.length}</p>
          <p className="mt-1 text-xs text-zinc-500">Workouts</p>
        </div>
        <div className="rounded-2xl border border-zinc-100 bg-white shadow-sm p-4 text-center">
          <p className="text-2xl font-bold text-zinc-900">{thisMonthCount}</p>
          <p className="mt-1 text-xs text-zinc-500">This month</p>
        </div>
        <div className="rounded-2xl border border-zinc-100 bg-white shadow-sm p-4 text-center">
          <p className="text-2xl font-bold text-zinc-900">{totalSets}</p>
          <p className="mt-1 text-xs text-zinc-500">Total sets</p>
        </div>
      </section>

      {/* Current program */}
      {programName && (
        <section className="mb-6">
          <div
            className="flex items-center gap-3 rounded-2xl px-5 py-4"
            style={{ background: 'linear-gradient(135deg, #166534, #16a34a)' }}
          >
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-green-200">Current program</p>
              <p className="mt-0.5 truncate text-sm font-bold text-white">{programName}</p>
            </div>
          </div>
        </section>
      )}

      {/* Big-three 1RMs */}
      {orms.length > 0 && (
        <section className="mb-8 rounded-2xl border border-zinc-100 bg-white shadow-sm p-5">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            1-Rep Maxes
          </h2>
          <div className="grid grid-cols-3 gap-4">
            {orms.map(({ label, value }) => (
              <div key={label} className="text-center">
                <p className="text-lg font-bold">{value}</p>
                <p className="text-xs text-zinc-500">{unit} · {label}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Recent workouts feed */}
      <section>
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Recent highlights
        </h2>

        {feedItems.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-200 px-6 py-12 text-center">
            <p className="text-sm text-zinc-400">No workouts yet.</p>
          </div>
        ) : (
          <ul className="space-y-4">
            {feedItems.map((item) => (
              <li key={item.workout.id}>
                <FeedCard
                  item={item}
                  displayName={displayName}
                  userInitial={initial}
                  username={profile.username}
                  avatarUrl={avatarUrl}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="h-4" />
    </div>
  )
}

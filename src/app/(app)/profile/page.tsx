import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase-server'

export default async function ProfilePage() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) redirect('/login')

  const [
    { data: profile },
    { count: followersCount },
    { count: followingCount },
    { count: workoutCount },
    { data: enrollment },
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('username, display_name, squat_1rm, bench_1rm, deadlift_1rm, preferred_unit, avatar_url')
      .eq('id', user.id)
      .maybeSingle(),
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', user.id),
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', user.id),
    supabase.from('workouts').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
    supabase
      .from('program_enrollments')
      .select('id, start_date, end_date, program_templates(name)')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle(),
  ])

  const programName = (enrollment?.program_templates as any)?.name as string | undefined

  const displayName = profile?.display_name || profile?.username || user.email?.split('@')[0] || 'You'
  const initial = (displayName[0] ?? '?').toUpperCase()
  const avatarUrl = (profile as any)?.avatar_url ?? null
  const unit = (profile?.preferred_unit as 'lb' | 'kg') ?? 'lb'

  const squat    = profile?.squat_1rm    ?? 0
  const bench    = profile?.bench_1rm    ?? 0
  const deadlift = profile?.deadlift_1rm ?? 0
  const total    = squat + bench + deadlift
  const hasLifts = total > 0

  return (
    <div className="mx-auto max-w-lg px-4 pb-20 pt-10">

      {/* Hero (centered) */}
      <div className="mb-8 flex flex-col items-center text-center">
        <div
          className="mb-4 flex h-20 w-20 items-center justify-center overflow-hidden rounded-full text-2xl font-black text-white shadow-md"
          style={{ background: 'linear-gradient(135deg, #166534, #16a34a)' }}
        >
          {avatarUrl
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={avatarUrl} alt={displayName} className="h-full w-full object-cover" />
            : initial}
        </div>

        <h1 className="text-2xl font-extrabold tracking-tight text-zinc-900">{displayName}</h1>
        {profile?.username && (
          <p className="mt-0.5 text-sm text-zinc-400">@{profile.username}</p>
        )}

        <div className="mt-4 flex items-center gap-1 text-sm">
          <Link
            href="/profile/followers"
            className="flex flex-col items-center px-4 py-1.5 rounded-xl hover:bg-zinc-100 transition-colors"
          >
            <span className="text-base font-bold tabular-nums text-zinc-900">{followersCount ?? 0}</span>
            <span className="text-[11px] text-zinc-400">Followers</span>
          </Link>
          <span className="text-zinc-200 select-none">·</span>
          <Link
            href="/profile/following"
            className="flex flex-col items-center px-4 py-1.5 rounded-xl hover:bg-zinc-100 transition-colors"
          >
            <span className="text-base font-bold tabular-nums text-zinc-900">{followingCount ?? 0}</span>
            <span className="text-[11px] text-zinc-400">Following</span>
          </Link>
          <span className="text-zinc-200 select-none">·</span>
          <div className="flex flex-col items-center px-4 py-1.5">
            <span className="text-base font-bold tabular-nums text-zinc-900">{workoutCount ?? 0}</span>
            <span className="text-[11px] text-zinc-400">Workouts</span>
          </div>
        </div>
      </div>

      {/* Current program */}
      {programName && (
        <div
          className="mb-6 flex items-center gap-3 rounded-2xl px-5 py-4"
          style={{ background: 'linear-gradient(135deg, #166534, #16a34a)' }}
        >
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-green-200">Current program</p>
            <p className="mt-0.5 truncate text-sm font-bold text-white">{programName}</p>
          </div>
          <Link
            href="/start"
            className="shrink-0 rounded-xl bg-white/20 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-sm hover:bg-white/30 transition-colors"
          >
            Lift →
          </Link>
        </div>
      )}

      {/* Bento Strength Dashboard */}
      {hasLifts && (
        <div className="mb-6">
          <p className="mb-3 px-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
            1-Rep Maxes
          </p>

          <div className="grid grid-cols-3 gap-2.5 mb-2.5">
            {[
              { label: 'Squat',    value: squat },
              { label: 'Bench',    value: bench },
              { label: 'Deadlift', value: deadlift },
            ].map(({ label, value }) => (
              <div
                key={label}
                className="flex flex-col items-center justify-center rounded-2xl border border-zinc-100 bg-white px-3 py-5 shadow-sm"
              >
                <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">{label}</p>
                <p className="text-2xl font-black tabular-nums text-zinc-900 leading-none">
                  {value > 0 ? value : <span className="text-zinc-300">—</span>}
                </p>
                <p className="mt-1 text-[11px] text-zinc-400">{unit}</p>
              </div>
            ))}
          </div>

          {squat > 0 && bench > 0 && deadlift > 0 && (
            <div
              className="flex items-center justify-between rounded-2xl px-7 py-5 shadow-sm"
              style={{ background: 'linear-gradient(135deg, #166534, #16a34a)' }}
            >
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-green-200">Total</p>
                <p className="text-4xl font-black tabular-nums leading-none text-white mt-0.5">{total}</p>
                <p className="text-[11px] text-green-300 mt-1">{unit} big three</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Settings row */}
      <Link
        href="/profile/settings"
        className="flex items-center gap-3 rounded-2xl border border-zinc-100 bg-white px-5 py-4 shadow-sm transition hover:border-zinc-200 hover:bg-zinc-50"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-zinc-600">
            <path fillRule="evenodd" d="M7.84 1.804A1 1 0 018.82 1h2.36a1 1 0 01.98.804l.331 1.652a6.993 6.993 0 011.929 1.115l1.598-.54a1 1 0 011.186.447l1.18 2.044a1 1 0 01-.205 1.251l-1.267 1.113a7.047 7.047 0 010 2.228l1.267 1.113a1 1 0 01.206 1.25l-1.18 2.045a1 1 0 01-1.187.447l-1.598-.54a6.993 6.993 0 01-1.929 1.115l-.33 1.652a1 1 0 01-.98.804H8.82a1 1 0 01-.98-.804l-.331-1.652a6.993 6.993 0 01-1.929-1.115l-1.598.54a1 1 0 01-1.186-.447l-1.18-2.044a1 1 0 01.205-1.251l1.267-1.114a7.05 7.05 0 010-2.227L1.821 7.773a1 1 0 01-.206-1.25l1.18-2.045a1 1 0 011.187-.447l1.598.54A6.993 6.993 0 017.51 3.456l.33-1.652zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
          </svg>
        </div>
        <span className="flex-1 text-sm font-medium text-zinc-800">Settings</span>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-zinc-300">
          <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
        </svg>
      </Link>

    </div>
  )
}

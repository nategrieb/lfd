import { createServerSupabase } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import FollowButton from './FollowButton'

type SearchParams = Promise<{ q?: string }>

export default async function PeoplePage({ searchParams }: { searchParams: SearchParams }) {
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.id) redirect('/login')

  const { q: rawQ } = await searchParams
  const q = (rawQ ?? '').trim().slice(0, 50)

  // Who the current user is following
  const { data: followingData } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', user.id)

  const followingIds = new Set((followingData ?? []).map((f) => f.following_id))

  // Search results (min 2 chars to avoid querying everything)
  type Profile = { id: string; username: string | null; display_name: string | null }
  let searchResults: Profile[] = []
  if (q.length >= 2) {
    const [{ data: byUsername }, { data: byName }] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, username, display_name')
        .ilike('username', `%${q}%`)
        .neq('id', user.id)
        .limit(20),
      supabase
        .from('profiles')
        .select('id, username, display_name')
        .ilike('display_name', `%${q}%`)
        .neq('id', user.id)
        .limit(20),
    ])
    // Merge and deduplicate by id
    const seen = new Set<string>()
    for (const row of [...(byUsername ?? []), ...(byName ?? [])]) {
      if (!seen.has(row.id)) { seen.add(row.id); searchResults.push(row as Profile) }
    }
  }

  // Profiles of people the user is already following
  let followingProfiles: Profile[] = []
  if (followingIds.size > 0) {
    const { data } = await supabase
      .from('profiles')
      .select('id, username, display_name')
      .in('id', [...followingIds])
    followingProfiles = (data ?? []) as Profile[]
  }

  return (
    <div className="mx-auto max-w-lg px-5 py-8">

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight">Find Friends</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Follow friends to see their workouts in your feed.
        </p>
      </div>

      {/* Search form */}
      <form method="GET" className="mb-8">
        <div className="flex gap-2">
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search by username…"
            autoComplete="off"
            className="flex-1 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm text-white placeholder-zinc-500 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
          />
          <button
            type="submit"
            className="rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-black hover:bg-amber-400 transition-colors"
          >
            Search
          </button>
        </div>
      </form>

      {/* Search results */}
      {q.length >= 2 && (
        <section className="mb-8">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Results
          </h2>
          {searchResults.length === 0 ? (
            <p className="text-sm text-zinc-500">No users found for &ldquo;{q}&rdquo;.</p>
          ) : (
            <ul className="space-y-2">
              {searchResults.map((profile) => {
                const href = profile.username ? `/people/${profile.username}` : null
                const inner = (
                  <>
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-700 text-sm font-bold text-white">
                      {((profile.display_name ?? profile.username)?.[0] ?? '?').toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      {profile.display_name && (
                        <p className="truncate text-sm font-semibold">{profile.display_name}</p>
                      )}
                      <p className={`truncate text-xs ${profile.display_name ? 'text-zinc-500' : 'text-sm font-semibold text-white'}`}>
                        {profile.username ? `@${profile.username}` : profile.id.slice(0, 8)}
                      </p>
                    </div>
                  </>
                )
                return (
                  <li
                    key={profile.id}
                    className="flex items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3"
                  >
                    {href ? (
                      <Link href={href} className="flex min-w-0 flex-1 items-center gap-3 hover:opacity-80 transition-opacity">
                        {inner}
                      </Link>
                    ) : (
                      <div className="flex min-w-0 flex-1 items-center gap-3">{inner}</div>
                    )}
                    <FollowButton
                      userId={profile.id}
                      initialIsFollowing={followingIds.has(profile.id)}
                    />
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      )}

      {/* Following list */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Following{followingProfiles.length > 0 ? ` · ${followingProfiles.length}` : ''}
        </h2>
        {followingProfiles.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-700 px-6 py-10 text-center">
            <p className="text-sm text-zinc-400">You&apos;re not following anyone yet.</p>
            <p className="mt-1 text-xs text-zinc-600">
              Search for a username above to find friends.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {followingProfiles.map((profile) => {
              const href = profile.username ? `/people/${profile.username}` : null
              const inner = (
                <>
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500 text-sm font-bold text-black">
                    {((profile.display_name ?? profile.username)?.[0] ?? '?').toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    {profile.display_name && (
                      <p className="truncate text-sm font-semibold">{profile.display_name}</p>
                    )}
                    <p className={`truncate text-xs ${profile.display_name ? 'text-zinc-500' : 'text-sm font-semibold text-white'}`}>
                      {profile.username ? `@${profile.username}` : profile.id.slice(0, 8)}
                    </p>
                  </div>
                </>
              )
              return (
                <li
                  key={profile.id}
                  className="flex items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3"
                >
                  {href ? (
                    <Link href={href} className="flex min-w-0 flex-1 items-center gap-3 hover:opacity-80 transition-opacity">
                      {inner}
                    </Link>
                  ) : (
                    <div className="flex min-w-0 flex-1 items-center gap-3">{inner}</div>
                  )}
                  <FollowButton userId={profile.id} initialIsFollowing={true} />
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}

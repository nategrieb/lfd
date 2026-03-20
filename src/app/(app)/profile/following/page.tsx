import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase-server'
import FollowButton from '../../people/FollowButton'

export default async function FollowingPage() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) redirect('/login')

  const { data: followingRows } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', user.id)

  const followingIds = (followingRows ?? []).map((r) => r.following_id)

  type Profile = { id: string; username: string | null; display_name: string | null; avatar_url: string | null }
  let profiles: Profile[] = []

  if (followingIds.length > 0) {
    const { data } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url')
      .in('id', followingIds)
    profiles = (data ?? []) as Profile[]
  }

  return (
    <div className="mx-auto max-w-lg px-4 pb-12 pt-6">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/profile" className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 hover:bg-zinc-200 transition-colors" aria-label="Back">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
          </svg>
        </Link>
        <h1 className="text-lg font-bold text-zinc-900">Following <span className="text-zinc-400 font-normal">· {followingIds.length}</span></h1>
      </div>

      {profiles.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-zinc-200 px-6 py-14 text-center">
          <p className="text-sm text-zinc-400">Not following anyone yet.</p>
          <Link href="/search?tab=people" className="mt-2 inline-block text-xs font-medium text-green-700 hover:underline">
            Find people to follow →
          </Link>
        </div>
      ) : (
        <ul className="overflow-hidden rounded-3xl border border-zinc-100 bg-white shadow-sm divide-y divide-zinc-50">
          {profiles.map((p) => {
            const name = p.display_name || p.username || 'User'
            const initial = (name[0] ?? '?').toUpperCase()
            return (
              <li key={p.id} className="flex items-center gap-3 px-5 py-3.5">
                <Link
                  href={p.username ? `/people/${p.username}` : '#'}
                  className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-bold text-white"
                  style={{ background: 'linear-gradient(135deg, #166534, #16a34a)' }}
                >
                  {p.avatar_url
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={p.avatar_url} alt={name} className="h-full w-full object-cover" />
                    : initial}
                </Link>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-900">{name}</p>
                  {p.username && <p className="text-xs text-zinc-400">@{p.username}</p>}
                </div>
                <FollowButton userId={p.id} initialIsFollowing={true} />
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

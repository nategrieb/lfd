import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase-server'
import MarkReadOnMount from './MarkReadOnMount'

export const dynamic = 'force-dynamic'

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)
  if (mins  < 1)  return 'just now'
  if (mins  < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

export default async function NotificationsPage() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) redirect('/login')

  const { data: rawNotifs } = await supabase
    .from('notifications')
    .select('id, type, created_at, read_at, workout_id, actor_id, comment_id')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50)

  const notifs = rawNotifs ?? []

  // Batch-fetch actor profiles and comment bodies
  const actorIds    = [...new Set(notifs.map(n => n.actor_id))]
  const commentIds  = notifs.filter(n => n.comment_id).map(n => n.comment_id!)

  const [{ data: actorProfiles }, { data: commentRows }] = await Promise.all([
    actorIds.length > 0
      ? supabase.from('profiles').select('id, display_name, username, avatar_url').in('id', actorIds)
      : Promise.resolve({ data: [] }),
    commentIds.length > 0
      ? supabase.from('workout_comments').select('id, body').in('id', commentIds)
      : Promise.resolve({ data: [] }),
  ])

  const profileMap = Object.fromEntries((actorProfiles ?? []).map(p => [p.id, p]))
  const commentMap = Object.fromEntries((commentRows ?? []).map(c => [c.id, c.body as string]))

  return (
    <div className="mx-auto max-w-lg px-4 pb-20 pt-8">
      {/* Marks all as read once the page mounts */}
      <MarkReadOnMount />

      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 hover:bg-zinc-200 transition-colors"
          aria-label="Back"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
          </svg>
        </Link>
        <h1 className="text-lg font-bold text-zinc-900">Notifications</h1>
      </div>

      {notifs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-200 px-6 py-12 text-center">
          <p className="text-sm font-medium text-zinc-400">No notifications yet.</p>
          <p className="mt-1 text-xs text-zinc-300">When someone jorks your beanits or comments, it'll show here.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {notifs.map(n => {
            const actor   = profileMap[n.actor_id]
            const name    = actor?.display_name || actor?.username || 'Someone'
            const initial = (name[0] ?? '?').toUpperCase()
            const isUnread = !n.read_at
            const href = n.workout_id ? `/workout/${n.workout_id}/summary` : '/'
            const commentBody = n.comment_id ? commentMap[n.comment_id] : null

            return (
              <li key={n.id}>
                <Link
                  href={href}
                  className={`flex items-start gap-3 rounded-2xl border px-4 py-3.5 transition hover:border-zinc-200 hover:bg-zinc-50 ${
                    isUnread
                      ? 'border-green-100 bg-green-50'
                      : 'border-zinc-100 bg-white'
                  }`}
                >
                  {/* Actor avatar */}
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-bold text-white"
                    style={{ background: 'linear-gradient(135deg, #166534, #16a34a)' }}
                  >
                    {actor?.avatar_url
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={actor.avatar_url} alt={name} className="h-full w-full object-cover" />
                      : initial}
                  </div>

                  <div className="min-w-0 flex-1">
                    {n.type === 'jork' ? (
                      <p className="text-sm text-zinc-800">
                        <span className="font-semibold">{name}</span>
                        {' jorked your beanits '}
                        <span className="text-base">🤜</span>
                      </p>
                    ) : (
                      <p className="text-sm text-zinc-800">
                        <span className="font-semibold">{name}</span>
                        {' commented on your workout'}
                        {commentBody && (
                          <span className="mt-0.5 block truncate text-xs text-zinc-500">"{commentBody}"</span>
                        )}
                      </p>
                    )}
                    <p className="mt-0.5 text-xs text-zinc-400">{timeAgo(n.created_at)}</p>
                  </div>

                  {isUnread && (
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-green-600" />
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

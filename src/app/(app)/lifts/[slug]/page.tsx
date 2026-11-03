import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase-server'
import { getAuthUser } from '@/lib/auth-user'
import { loadLiftHistory } from '@/lib/lift-history'
import LiftHistoryView from '@/components/LiftHistoryView'
import BackButton from '@/components/BackButton'
import ShareLinkButton from '@/components/ShareLinkButton'

const SESSIONS_PER_PAGE = 20
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function LiftDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ show?: string; user?: string }>
}) {
  const { slug } = await params
  const { show, user: userParam } = await searchParams
  const supabase = await createServerSupabase()
  const user = await getAuthUser()
  if (!user?.id) redirect('/login')

  // ?user=<id> shows someone else's history for this lift (visible only if RLS lets us read their sets).
  const viewingOther = !!userParam && UUID.test(userParam) && userParam !== user.id
  const targetUserId = viewingOther ? userParam! : user.id
  const userQuery = viewingOther ? `user=${targetUserId}` : ''

  // Never redirect here: a redirect leaves an extra entry in the browser history and Back then bounces forward again.
  // If the sets live under a different catalogue slug, show that history at this address instead.
  const [{ data: owner }, first] = await Promise.all([
    supabase.from('profiles').select('username, display_name').eq('id', targetUserId).maybeSingle(),
    loadLiftHistory(supabase, { slug, userId: targetUserId, allowEmpty: true }),
  ])
  let shareSlug = slug
  let result = first
  if (result.kind === 'redirect') {
    shareSlug = result.slug
    result = await loadLiftHistory(supabase, { slug: result.slug, userId: targetUserId, allowEmpty: true })
  }
  if (result.kind !== 'ok') redirect('/lifts')

  const ownerName = owner?.display_name || owner?.username || 'Their'
  const requested = Number.parseInt(show ?? '', 10)
  const visibleCount = Number.isFinite(requested) && requested > 0 ? requested : SESSIONS_PER_PAGE
  const sharePath = owner?.username ? `/l/${owner.username}/${shareSlug}` : null

  return (
    <div className="mx-auto max-w-lg px-5 py-8">
      <LiftHistoryView
        history={result.history}
        leading={<BackButton fallback={viewingOther && owner?.username ? `/people/${owner.username}` : '/lifts'} className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-zinc-200 text-zinc-400 transition-colors hover:border-zinc-300 hover:text-zinc-700" />}
        trailing={sharePath ? <ShareLinkButton path={sharePath} title={`${result.history.title} history`} /> : null}
        eyebrow={viewingOther ? (owner?.display_name || owner?.username ? `${ownerName}’s lift` : 'Their lift') : undefined}
        sessionHref={(id) => `/workout/${id}/summary`}
        moreHref={(count) => `?show=${count}${userQuery ? `&${userQuery}` : ''}`}
        visibleCount={visibleCount}
        perPage={SESSIONS_PER_PAGE}
      />
    </div>
  )
}

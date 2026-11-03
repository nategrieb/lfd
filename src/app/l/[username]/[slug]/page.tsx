import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import type { Metadata } from 'next'
import { getSupabasePublishableOrAnonKey, getSupabaseUrl } from '@/lib/supabase-config'
import { loadLiftHistory } from '@/lib/lift-history'
import LiftHistoryView from '@/components/LiftHistoryView'

export const dynamic = 'force-dynamic'

const SESSIONS_PER_PAGE = 20

type Props = {
  params: Promise<{ username: string; slug: string }>
  searchParams: Promise<{ show?: string }>
}

// Public anon client: no cookies, works for anyone with the link. Only completed workouts are readable this way.
function anonSupabase() {
  return createClient(getSupabaseUrl(), getSupabasePublishableOrAnonKey(), { db: { schema: 'lfd' } })
}

async function load(username: string, slug: string) {
  const supabase = anonSupabase()
  const { data: profile } = await supabase.from('profiles').select('id, username, display_name').eq('username', username).maybeSingle()
  if (!profile) return null
  let result = await loadLiftHistory(supabase, { slug, userId: profile.id, allowEmpty: false })
  if (result.kind === 'redirect') result = await loadLiftHistory(supabase, { slug: result.slug, userId: profile.id, allowEmpty: false })
  if (result.kind !== 'ok') return null
  return { profile, history: result.history }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username, slug } = await params
  const data = await load(username, slug)
  if (!data) return { title: 'Lift history' }
  const name = data.profile.display_name || data.profile.username
  const { history } = data
  return {
    title: `${name}’s ${history.title} · LFD`,
    description: `${history.sessions.length} sessions. Best set ${history.prWeight} lbs × ${history.prReps}${history.prE1RM > 0 ? `, est. 1RM ${history.prE1RM} lbs` : ''}.`,
  }
}

/** Public, read-only lift history for a share link: /l/<username>/<lift>. */
export default async function PublicLiftPage({ params, searchParams }: Props) {
  const { username, slug } = await params
  const { show } = await searchParams
  const data = await load(username, slug)
  if (!data) notFound()

  const name = data.profile.display_name || data.profile.username
  const requested = Number.parseInt(show ?? '', 10)
  const visibleCount = Number.isFinite(requested) && requested > 0 ? requested : SESSIONS_PER_PAGE

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <div className="mx-auto max-w-lg px-5 py-8">
        <LiftHistoryView
          history={data.history}
          eyebrow={`${name}’s lift`}
          sessionHref={(id) => `/w/${id}`}
          moreHref={(count) => `?show=${count}`}
          visibleCount={visibleCount}
          perPage={SESSIONS_PER_PAGE}
        />

        <div className="mt-10 rounded-2xl border border-zinc-100 bg-white p-5 text-center shadow-sm">
          <p className="text-sm font-semibold">Track your lifts with LFD</p>
          <p className="mt-1 text-xs text-zinc-400">Log sets, film your lifts and follow your friends.</p>
          <Link href="/login" className="mt-3 inline-block rounded-xl px-5 py-2.5 text-sm font-semibold text-white" style={{ background: 'linear-gradient(135deg, #166534, #16a34a)' }}>
            Get started
          </Link>
        </div>
      </div>
    </div>
  )
}

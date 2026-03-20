import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase-server'
import StrongImporter from './StrongImporter'
import { ConnectStravaButton, DisconnectStravaButton, StravaConnectedBadge } from './StravaButtons'

export default async function IntegrationsPage() {
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.id) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('strava_athlete_id')
    .eq('id', user.id)
    .single()

  const isStravaConnected = !!profile?.strava_athlete_id
  const stravaClientId = process.env.NEXT_PUBLIC_STRAVA_CLIENT_ID ?? ''
  const redirectUri = `${process.env.NEXT_PUBLIC_BASE_URL ?? ''}/api/strava/callback`

  return (
    <div className="mx-auto max-w-lg px-5 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight">Integrations</h1>
        <p className="mt-1 text-sm text-zinc-400">Connect apps and import workout history.</p>
      </header>

      {/* ── Strava ───────────────────────────────────────────── */}
      <section className="mb-4 rounded-2xl border border-zinc-100 bg-white shadow-sm p-6">
        <h2 className="mb-4 text-lg font-semibold">Connected Apps</h2>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
              style={{ background: '#FC4C02' }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="white" aria-hidden="true">
                <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0 4 13.828h4.172" />
              </svg>
            </div>
            <div>
              <p className="font-semibold">Strava</p>
              <p className="text-xs text-zinc-400">Auto-post workouts as WeightTraining activities</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {isStravaConnected && <StravaConnectedBadge />}
            {isStravaConnected
              ? <DisconnectStravaButton />
              : <ConnectStravaButton clientId={stravaClientId} redirectUri={redirectUri} />
            }
          </div>
        </div>
      </section>

      {/* ── File Imports ─────────────────────────────────────── */}
      <section className="rounded-2xl border border-zinc-100 bg-white shadow-sm p-6">
        <h2 className="text-lg font-semibold">File Imports</h2>

        <div className="mt-5 border-t border-zinc-100 pt-5">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-xs font-bold tracking-tight text-green-700">
              S
            </div>
            <div>
              <p className="font-semibold">Strong App</p>
              <p className="text-xs text-zinc-400">
                Export from Strong → Settings → Export Workouts (CSV)
              </p>
            </div>
          </div>

          <StrongImporter />
        </div>
      </section>
    </div>
  )
}

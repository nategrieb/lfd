'use client'

import { useTransition } from 'react'
import { disconnectStrava } from './strava-actions'

const STRAVA_ORANGE = '#FC4C02'

function StravaLogo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={STRAVA_ORANGE} aria-hidden="true">
      <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0 4 13.828h4.172" />
    </svg>
  )
}

// ── Connect button (shown when not yet connected) ─────────────────────────

export function ConnectStravaButton({ clientId, redirectUri }: { clientId: string; redirectUri: string }) {
  const scope = 'activity:write'
  const url = `https://www.strava.com/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&approval_prompt=auto&scope=${scope}`

  return (
    <a
      href={url}
      className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white transition hover:opacity-90"
      style={{ background: STRAVA_ORANGE }}
    >
      <StravaLogo size={16} />
      Connect with Strava
    </a>
  )
}

// ── Disconnect button (shown when connected) ──────────────────────────────

export function DisconnectStravaButton() {
  const [isPending, startTransition] = useTransition()

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => startTransition(async () => { await disconnectStrava() })}
      className="rounded-xl border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-500 transition hover:bg-zinc-50 disabled:opacity-50"
    >
      {isPending ? 'Disconnecting…' : 'Disconnect'}
    </button>
  )
}

// ── Status badge ──────────────────────────────────────────────────────────

export function StravaConnectedBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-600">
      <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
      Connected
    </span>
  )
}

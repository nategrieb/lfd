'use client'

import { useState, useTransition } from 'react'
import { syncWorkoutToStrava } from '@/app/(app)/settings/integrations/strava-actions'

const STRAVA_ORANGE = '#FC4C02'

export default function SyncToStravaButton({ workoutId }: { workoutId: string }) {
  const [isPending, startTransition] = useTransition()
  const [status, setStatus] = useState<'idle' | 'done' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const handleSync = () => {
    startTransition(async () => {
      const result = await syncWorkoutToStrava(workoutId)
      if ('error' in result) {
        setStatus('error')
        setErrorMsg(result.error)
      } else {
        setStatus('done')
      }
    })
  }

  if (status === 'done') {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-orange-100 bg-orange-50 px-4 py-2.5 text-sm font-semibold text-orange-600">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
          <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
        </svg>
        Synced to Strava
      </div>
    )
  }

  return (
    <div>
      <button
        type="button"
        disabled={isPending}
        onClick={handleSync}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-60"
        style={{ background: STRAVA_ORANGE }}
      >
        {/* Strava chevron logo */}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="white" aria-hidden="true">
          <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0 4 13.828h4.172" />
        </svg>
        {isPending ? 'Syncing…' : 'Sync to Strava'}
      </button>
      {status === 'error' && (
        <p className="mt-2 text-xs text-red-500">{errorMsg}</p>
      )}
    </div>
  )
}

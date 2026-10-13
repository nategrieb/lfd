'use client'

import { useEffect, useRef, useState } from 'react'

import { createClient } from '@/lib/supabase'

type GoogleIdApi = {
  initialize: (config: {
    client_id: string
    callback: (response: { credential: string }) => void
    nonce?: string
    use_fedcm_for_prompt?: boolean
  }) => void
  renderButton: (parent: HTMLElement, options: Record<string, string | number | boolean>) => void
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleIdApi } }
  }
}

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
const SCRIPT_SRC = 'https://accounts.google.com/gsi/client'

/** Google wants a SHA-256 hash of the nonce; Supabase wants the original so it can check they match. */
async function makeNonce() {
  const raw = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))))
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw))
  const hashed = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
  return { raw, hashed }
}

/**
 * Google's own sign-in button, shown in a popup on this site, so the account chooser says
 * nategrieb.com instead of the Supabase address. Only active when NEXT_PUBLIC_GOOGLE_CLIENT_ID
 * is set; otherwise (or if the popup can't load) the original redirect button is used.
 */
export default function GoogleSignIn({ afterSignIn = '/' }: { afterSignIn?: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [popupReady, setPopupReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const clientId = GOOGLE_CLIENT_ID
    if (!clientId) return

    let cancelled = false

    const start = async () => {
      const google = window.google?.accounts.id
      const container = containerRef.current
      if (!google || !container || cancelled) return

      const { raw, hashed } = await makeNonce()
      if (cancelled) return

      google.initialize({
        client_id: clientId,
        nonce: hashed,
        use_fedcm_for_prompt: true,
        callback: async (response) => {
          setBusy(true)
          setError(null)
          const { error: signInError } = await createClient().auth.signInWithIdToken({
            provider: 'google',
            token: response.credential,
            nonce: raw,
          })

          if (signInError) {
            setError("Google sign-in did not complete. Please try again.")
            setBusy(false)
            return
          }

          window.location.assign(afterSignIn)
        },
      })

      google.renderButton(container, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        text: 'continue_with',
        shape: 'rectangular',
        logo_alignment: 'left',
        width: Math.min(400, Math.max(200, container.clientWidth || 320)),
      })
      setPopupReady(true)
    }

    let script = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`)

    if (window.google?.accounts?.id) {
      void start()
    } else {
      if (!script) {
        script = document.createElement('script')
        script.src = SCRIPT_SRC
        script.async = true
        document.head.appendChild(script)
      }
      script.addEventListener('load', () => void start())
    }

    return () => {
      cancelled = true
    }
  }, [afterSignIn])

  async function signInWithRedirect() {
    setError(null)
    const { error: oauthError } = await createClient().auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })

    if (oauthError) {
      setError("Could not start Google sign-in. Please try again.")
    }
  }

  return (
    <div className="space-y-3">
      {GOOGLE_CLIENT_ID ? <div ref={containerRef} className="flex min-h-[44px] justify-center" /> : null}

      {popupReady ? (
        <button type="button" onClick={signInWithRedirect} className="text-xs text-zinc-500 underline underline-offset-4">
          Trouble signing in? Use the other Google sign-in
        </button>
      ) : (
        <button type="button" onClick={signInWithRedirect} className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-50">
          Continue with Google
        </button>
      )}

      {busy ? <p className="text-sm text-zinc-500">Signing in...</p> : null}
      {error ? <p className="rounded-lg bg-red-50 border border-red-300 px-4 py-3 text-sm text-red-800">{error}</p> : null}
    </div>
  )
}

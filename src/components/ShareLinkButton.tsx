'use client'

import { useState } from 'react'

type Props = {
  /** A path like /l/nate/squat; made absolute from the current site. */
  path: string
  title: string
  className?: string
}

const DEFAULT_CLASS =
  'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-zinc-200 text-zinc-500 transition-colors hover:border-zinc-300 hover:text-zinc-700'

/** Share a link with the phone's share sheet, or copy it where there isn't one. */
export default function ShareLinkButton({ path, title, className = DEFAULT_CLASS }: Props) {
  const [copied, setCopied] = useState(false)

  async function share() {
    const url = `${window.location.origin}${path}`
    if (navigator.share) {
      try {
        await navigator.share({ title, url })
      } catch {
        // cancelled
      }
      return
    }
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      window.prompt('Copy this link', url)
    }
  }

  return (
    <button type="button" onClick={share} aria-label="Share link" title="Share link" className={className}>
      {copied ? (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-green-600" aria-hidden="true">
          <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
        </svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
          <path d="M13 4.5a2.5 2.5 0 11.702 1.737L6.97 9.604a2.518 2.518 0 010 .792l6.733 3.367a2.5 2.5 0 11-.671 1.341l-6.733-3.367a2.5 2.5 0 110-3.474l6.733-3.366A2.52 2.52 0 0113 4.5z" />
        </svg>
      )}
    </button>
  )
}

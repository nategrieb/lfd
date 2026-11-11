'use client'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

/**
 * Two things that make taps feel received:
 *  - iPhone Safari only applies :active styles once a touchstart handler exists, so register a no-op one.
 *  - A thin progress bar at the top from the moment an internal link is tapped until the next page has arrived.
 */
export default function TouchFeedback() {
  const pathname = usePathname()
  const [loadingTo, setLoadingTo] = useState<string | null>(null)

  useEffect(() => {
    const noop = () => {}
    document.addEventListener('touchstart', noop, { passive: true })
    return () => document.removeEventListener('touchstart', noop)
  }, [])

  // Tapping a number field means typing a new number, so select what's there instead of making you clear it first.
  useEffect(() => {
    const onFocus = (e: FocusEvent) => {
      const el = e.target as HTMLInputElement | null
      if (!el || el.tagName !== 'INPUT') return
      if (el.type === 'number' || el.inputMode === 'decimal' || el.inputMode === 'numeric') {
        el.select()
        requestAnimationFrame(() => el.select())
      }
    }
    document.addEventListener('focusin', onFocus)
    return () => document.removeEventListener('focusin', onFocus)
  }, [])

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return
      const link = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!link || link.target === '_blank' || link.origin !== window.location.origin) return
      if (link.pathname === window.location.pathname) return
      setLoadingTo(link.pathname)
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [])

  useEffect(() => {
    setLoadingTo(null)
  }, [pathname])
  useEffect(() => {
    if (!loadingTo) return
    const giveUp = setTimeout(() => setLoadingTo(null), 10000)
    return () => clearTimeout(giveUp)
  }, [loadingTo])

  if (!loadingTo) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[300] h-[3px] overflow-hidden bg-green-100" role="progressbar" aria-label="Loading">
      <div className="nav-progress h-full bg-green-700" />
    </div>
  )
}

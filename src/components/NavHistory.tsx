'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'

const KEY = 'lfd:nav-stack'

function read(): string[] {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) ?? '[]') as string[]
  } catch {
    return []
  }
}

/** True when there is an earlier screen inside the app to go back to. */
export function canGoBackInApp(): boolean {
  return read().length > 1
}

/** Bottom-tab taps start a fresh trail: a tab is a place to be, not a step deeper. */
export function resetNavTrail() {
  try {
    sessionStorage.setItem(KEY, '[]')
  } catch {
    // Private mode: back falls back to each screen's parent.
  }
}

/**
 * Remembers the screens you have been through in this tab, so Back can return to the one you came from
 * (rather than a fixed parent). Going back pops the trail; opening a tab restarts it.
 */
export default function NavHistory() {
  const pathname = usePathname()
  const lastLength = useRef<number | null>(null)
  const poppedRef = useRef(false)

  // Back and forward buttons fire popstate; links and redirects do not.
  useEffect(() => {
    const onPop = () => {
      poppedRef.current = true
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  useEffect(() => {
    const stack = read()
    const top = stack[stack.length - 1]
    const length = window.history.length
    const popped = poppedRef.current
    poppedRef.current = false

    if (top !== pathname) {
      if (popped) {
        if (stack.length > 1 && stack[stack.length - 2] === pathname) stack.pop() // went back
        else stack.push(pathname)
      } else if (lastLength.current !== null && length === lastLength.current && stack.length > 0) {
        // A redirect replaces the page instead of adding one: swap the last stop rather than adding another.
        stack[stack.length - 1] = pathname
      } else {
        stack.push(pathname)
      }
      try {
        sessionStorage.setItem(KEY, JSON.stringify(stack.slice(-30)))
      } catch {
        // ignore
      }
    }
    lastLength.current = length
  }, [pathname])

  return null
}

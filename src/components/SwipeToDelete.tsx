'use client'

import { useRef, useState } from 'react'

const REVEAL = 72 // how far a swipe opens the delete button
const FULL = 150 // swipe this far and it deletes without another tap

/**
 * Swipe a row left to reveal a trash button (tap it to delete), or swipe all the way to delete at once.
 * Vertical scrolling still works, and taps on inputs inside the row are untouched.
 */
export default function SwipeToDelete({ children, onDelete, label = 'Delete' }: { children: React.ReactNode; onDelete: () => void; label?: string }) {
  const [offset, setOffset] = useState(0)
  const [dragging, setDragging] = useState(false)
  const start = useRef<{ x: number; y: number; base: number } | null>(null)
  const open = offset <= -REVEAL / 2

  const onPointerDown = (e: React.PointerEvent) => {
    start.current = { x: e.clientX, y: e.clientY, base: offset }
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const s = start.current
    if (!s) return
    const dx = e.clientX - s.x
    const dy = e.clientY - s.y
    if (!dragging) {
      // Only a mostly sideways move counts as a swipe.
      if (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(dy) * 1.5) return
      setDragging(true)
      try {
        ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
      } catch {
        // Not every pointer can be captured; the swipe still works without it.
      }
    }
    setOffset(Math.max(-FULL - 40, Math.min(0, s.base + dx)))
  }
  const finish = () => {
    start.current = null
    if (!dragging) return
    setDragging(false)
    if (offset <= -FULL) onDelete()
    else setOffset(offset <= -REVEAL / 2 ? -REVEAL : 0)
  }

  return (
    <div className="relative overflow-hidden rounded-lg">
      <button
        type="button"
        onClick={onDelete}
        aria-label={label}
        tabIndex={open ? 0 : -1}
        className="absolute inset-y-0 right-0 flex w-[72px] items-center justify-center bg-rose-500 text-white"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 7.5h15m-12 0V6a1.5 1.5 0 011.5-1.5h6A1.5 1.5 0 0116.5 6v1.5m-8.25 0V18A1.5 1.5 0 009.75 19.5h4.5A1.5 1.5 0 0015.75 18V7.5" />
        </svg>
      </button>
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finish}
        onPointerCancel={finish}
        style={{ transform: `translateX(${offset}px)`, transition: dragging ? 'none' : 'transform 180ms ease', touchAction: 'pan-y' }}
        className="relative"
      >
        {children}
      </div>
    </div>
  )
}

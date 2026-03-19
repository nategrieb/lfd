'use client'

import { useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'

type Props = {
  src: string
  title?: string
  onClose: () => void
}

/**
 * Full-screen video modal.
 *
 * Dismissal:
 *  - Tap/click the × button
 *  - Press Escape
 *  - Swipe down ≥ 80 px (mobile)
 *  - Click the dark backdrop (desktop)
 */
export default function VideoModal({ src, title, onClose }: Props) {
  const touchStartY = useRef<number>(0)
  const panelRef = useRef<HTMLDivElement>(null)

  // Lock body scroll while open
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  // Keyboard dismiss
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // Swipe-down-to-dismiss
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY
  }, [])

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    const delta = e.changedTouches[0].clientY - touchStartY.current
    if (delta > 80) onClose()
  }, [onClose])

  const modal = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title ?? 'Video player'}
      className="fixed inset-0 z-[100] flex flex-col bg-black"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Backdrop tap-to-close (desktop) — only triggers outside the video panel */}
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />

      {/* Video panel — stops click propagation so tapping video doesn't close */}
      <div
        ref={panelRef}
        className="relative z-10 flex flex-1 flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header bar */}
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          {title && (
            <p className="truncate text-sm font-semibold text-white">{title}</p>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close video"
            className="ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white transition" style={{ background: 'linear-gradient(135deg, #166534, #16a34a)' }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Swipe hint — visible for a moment on mobile */}
        <p className="text-center text-[10px] text-zinc-400 -mt-1 mb-2 select-none">
          Swipe down to close
        </p>

        {/* Video fills remaining space */}
        <div className="flex flex-1 items-center justify-center overflow-hidden">
          <video
            src={src}
            controls
            autoPlay
            playsInline
            preload="metadata"
            className="max-h-full max-w-full"
            style={{ objectFit: 'contain' }}
            onLoadedMetadata={(e) => { e.currentTarget.currentTime = 0.001 }}
          />
        </div>
      </div>
    </div>
  )

  // Render into document.body so it escapes any stacking context
  return typeof document !== 'undefined' ? createPortal(modal, document.body) : null
}

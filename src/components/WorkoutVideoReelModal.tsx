'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

type ReelClip = {
  id: string
  src: string
  title: string
  subtitle?: string
}

type Props = {
  clips: ReelClip[]
  initialIndex?: number
  onClose: () => void
}

export default function WorkoutVideoReelModal({ clips, initialIndex = 0, onClose }: Props) {
  const [activeIndex, setActiveIndex] = useState(() => Math.max(0, Math.min(initialIndex, clips.length - 1)))
  const [mounted, setMounted] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const sectionRefs = useRef<Array<HTMLElement | null>>([])
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({})
  const touchStartY = useRef(0)

  const clipCount = clips.length

  const clampIndex = useCallback((idx: number) => {
    return Math.max(0, Math.min(idx, clipCount - 1))
  }, [clipCount])

  const scrollToIndex = useCallback((idx: number, smooth = true) => {
    const container = containerRef.current
    if (!container) return
    const clamped = clampIndex(idx)
    const section = sectionRefs.current[clamped]
    if (section) {
      section.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' })
    } else {
      const top = clamped * container.clientHeight
      container.scrollTo({ top, behavior: smooth ? 'smooth' : 'auto' })
    }
    setActiveIndex(clamped)
  }, [clampIndex])

  const ensureInitialPosition = useCallback((idx: number) => {
    const clamped = clampIndex(idx)
    setActiveIndex(clamped)

    // Two-pass positioning avoids race conditions where the first layout pass
    // snaps back to index 0 before section heights are fully settled.
    requestAnimationFrame(() => {
      scrollToIndex(clamped, false)
      setTimeout(() => scrollToIndex(clamped, false), 80)
    })
  }, [clampIndex, scrollToIndex])

  const goNext = useCallback(() => {
    if (activeIndex < clipCount - 1) scrollToIndex(activeIndex + 1)
  }, [activeIndex, clipCount, scrollToIndex])

  const goPrev = useCallback(() => {
    if (activeIndex > 0) scrollToIndex(activeIndex - 1)
  }, [activeIndex, scrollToIndex])

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowUp') goPrev()
      if (e.key === 'ArrowDown') goNext()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [goNext, goPrev, onClose])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const onScroll = () => {
      const idx = Math.round(container.scrollTop / Math.max(container.clientHeight, 1))
      setActiveIndex(Math.max(0, Math.min(idx, clipCount - 1)))
    }
    container.addEventListener('scroll', onScroll)
    return () => container.removeEventListener('scroll', onScroll)
  }, [clipCount])

  useEffect(() => {
    ensureInitialPosition(initialIndex)
  }, [initialIndex, ensureInitialPosition])

  useEffect(() => {
    for (let i = 0; i < clips.length; i++) {
      const clip = clips[i]
      const el = videoRefs.current[clip.id]
      if (!el) continue
      if (i === activeIndex) {
        void el.play().catch(() => {})
      } else {
        el.pause()
      }
    }
  }, [activeIndex, clips])

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY
  }, [])

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    const delta = e.changedTouches[0].clientY - touchStartY.current
    if (delta < -60) goNext()
    if (delta > 60) goPrev()
  }, [goNext, goPrev])

  if (!mounted || clips.length === 0) return null

  const modal = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Workout video reel"
      className="fixed inset-0 z-[120] bg-black text-white"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className="absolute right-4 top-4 z-20">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close reel"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/60"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="pointer-events-none absolute right-3 top-1/2 z-20 -translate-y-1/2 rounded-full bg-black/50 px-2 py-1 text-xs">
        {activeIndex + 1}/{clipCount}
      </div>

      <div ref={containerRef} className="h-full snap-y snap-mandatory overflow-y-auto">
        {clips.map((clip, i) => (
          <section
            key={clip.id}
            ref={(el) => { sectionRefs.current[i] = el }}
            className="relative flex h-screen snap-start items-center justify-center px-2"
          >
            <video
              ref={(el) => { videoRefs.current[clip.id] = el }}
              src={clip.src}
              autoPlay={i === activeIndex}
              controls
              muted
              loop
              playsInline
              preload="metadata"
              className="max-h-[100svh] w-full"
              style={{ objectFit: 'contain' }}
              onLoadedData={(e) => {
                if (i === activeIndex) {
                  void e.currentTarget.play().catch(() => {})
                }
              }}
            />
          </section>
        ))}
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}
'use client'

import { useState, useEffect, useRef } from 'react'

type Props = {
  seconds: number
  label: string
}

export default function RestTimer({ seconds, label }: Props) {
  const [running, setRunning] = useState(false)
  const [remaining, setRemaining] = useState(seconds)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!running) return

    intervalRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(intervalRef.current!)
          setRunning(false)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(intervalRef.current!)
  }, [running])

  const handleClick = () => {
    if (running) {
      // Reset
      clearInterval(intervalRef.current!)
      setRunning(false)
      setRemaining(seconds)
    } else {
      setRemaining(seconds)
      setRunning(true)
    }
  }

  const display = running
    ? remaining >= 60
      ? `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`
      : `${remaining}s`
    : label

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold transition ${
        running
          ? remaining <= 10
            ? 'border-rose-500 text-rose-300 animate-pulse'
            : 'border-zinc-500 text-zinc-200'
          : 'border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200'
      }`}
      title={running ? 'Tap to reset timer' : 'Tap to start rest timer'}
    >
      {running ? '⏱ ' : ''}
      {display}
    </button>
  )
}

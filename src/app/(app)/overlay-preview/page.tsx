'use client'

import { useEffect, useRef, useState } from 'react'
import { renderOverlayCanvas, type OverlayData } from '@/lib/overlay-canvas'

type Preset = { w: number; h: number; label: string }

const PRESETS: Preset[] = [
  { w: 1920, h: 1080, label: '16:9 Landscape — 1920×1080' },
  { w: 1080, h: 1920, label: '9:16 Portrait — 1080×1920' },
  { w: 1080, h: 1080, label: '1:1 Square — 1080×1080' },
  { w: 1280, h: 720,  label: '16:9 HD — 1280×720' },
]

export default function OverlayPreviewPage() {
  const canvasRef    = useRef<HTMLCanvasElement>(null)
  const [exercise, setExercise]       = useState('Back Squat')
  const [weight,   setWeight]         = useState(255)
  const [reps,     setReps]           = useState(3)
  const [rpe,      setRpe]            = useState('9')
  const [orm,      setOrm]            = useState('300')
  const [dimIdx,   setDimIdx]         = useState(0)

  const dim = PRESETS[dimIdx]

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const data: OverlayData = {
      exerciseName: exercise,
      weight,
      reps,
      rpe:      rpe !== '' ? Number(rpe) : null,
      oneRepMax: orm !== '' ? Number(orm) : null,
    }
    renderOverlayCanvas(data, dim.w, dim.h, canvas)
  }, [exercise, weight, reps, rpe, orm, dim])

  return (
    <div className="mx-auto max-w-2xl px-5 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Overlay Preview</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Live canvas render of the video burn-in. Edit fields and the preview updates instantly — no upload or build needed.
        </p>
      </div>

      {/* Controls */}
      <div className="mb-6 rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <label className="col-span-2 flex flex-col gap-1 sm:col-span-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Exercise name</span>
            <input
              className="rounded-xl border border-zinc-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              value={exercise}
              onChange={(e) => setExercise(e.target.value)}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Weight (lbs)</span>
            <input
              type="number"
              className="rounded-xl border border-zinc-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              value={weight}
              onChange={(e) => setWeight(Number(e.target.value))}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Reps</span>
            <input
              type="number"
              className="rounded-xl border border-zinc-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              value={reps}
              onChange={(e) => setReps(Number(e.target.value))}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">RPE</span>
            <input
              type="number"
              step="0.5"
              min="1"
              max="10"
              placeholder="optional"
              className="rounded-xl border border-zinc-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              value={rpe}
              onChange={(e) => setRpe(e.target.value)}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">1RM (lbs)</span>
            <input
              type="number"
              placeholder="optional"
              className="rounded-xl border border-zinc-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              value={orm}
              onChange={(e) => setOrm(e.target.value)}
            />
          </label>

          <label className="col-span-2 flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Aspect ratio</span>
            <select
              className="rounded-xl border border-zinc-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              value={dimIdx}
              onChange={(e) => setDimIdx(Number(e.target.value))}
            >
              {PRESETS.map((p, i) => (
                <option key={i} value={i}>{p.label}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {/* Preview canvas */}
      <div className="overflow-hidden rounded-2xl bg-zinc-800 shadow-xl">
        {/* eslint-disable-next-line tailwindcss/no-arbitrary-value */}
        <div
          className="relative w-full"
          style={{ paddingTop: `${(dim.h / dim.w) * 100}%` }}
        >
          <canvas
            ref={canvasRef}
            className="absolute inset-0 h-full w-full"
          />
        </div>
      </div>

      <p className="mt-2 text-center text-xs text-zinc-400">
        Rendered at {dim.w}×{dim.h}px, scaled to fit. The overlay is a transparent PNG laid over video at this exact resolution.
      </p>
    </div>
  )
}

'use client'

import { useEffect, useRef, useState } from 'react'
import type { CatalogueExercise } from '@/lib/exercise-catalogue'

type Props = {
  value: string
  onChange: (value: string) => void
  onPick: (exercise: CatalogueExercise) => void
  placeholder?: string
}

/** Text input that suggests exercises from the ExerciseDB library as you type. */
export default function ExerciseSearchInput({ value, onChange, onPick, placeholder }: Props) {
  const [results, setResults] = useState<CatalogueExercise[]>([])
  const [open, setOpen] = useState(false)
  const skipNextSearch = useRef(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (skipNextSearch.current) {
      skipNextSearch.current = false
      return
    }
    const q = value.trim()
    if (q.length < 2) return

    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/exercises/search?q=${encodeURIComponent(q)}`, { signal: controller.signal })
        if (!res.ok) return
        const data = (await res.json()) as { exercises?: CatalogueExercise[] }
        setResults(data.exercises ?? [])
        // Only pop the list open while typing — not when a quick-pick pill fills the field.
        setOpen(document.activeElement === inputRef.current)
      } catch {
        // Aborted or offline — free-text entry still works.
      }
    }, 250)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [value])

  return (
    <div className="relative w-full">
      <input
        ref={inputRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        autoComplete="off"
        className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-green-700"
      />
      {open && value.trim().length >= 2 && results.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-zinc-200 bg-white shadow-lg">
          {results.map((exercise) => (
            <li key={exercise.id}>
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  skipNextSearch.current = true
                  onPick(exercise)
                  setOpen(false)
                }}
                className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-zinc-50"
              >
                {exercise.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={exercise.imageUrl} alt="" loading="lazy" className="h-10 w-10 shrink-0 rounded-md bg-zinc-100 object-cover" />
                ) : (
                  <span className="h-10 w-10 shrink-0 rounded-md bg-zinc-100" />
                )}
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-zinc-900">{exercise.name}</span>
                  <span className="block truncate text-xs capitalize text-zinc-500">
                    {[exercise.primaryMuscles.join(', '), exercise.equipment].filter(Boolean).join(' · ')}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

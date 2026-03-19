'use client'

import { useActionState, useRef, useState } from 'react'
import { importStrongCSV, type ImportResult } from './actions'

const initialState: ImportResult = { success: false, message: '' }

export default function StrongImporter() {
  const [state, formAction, isPending] = useActionState(importStrongCSV, initialState)
  const [filename, setFilename] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function applyFile(file: File) {
    if (!file.name.endsWith('.csv') && file.type !== 'text/csv') return
    setFilename(file.name)
    // Inject the file into the hidden input via DataTransfer so the form
    // submission picks it up correctly.
    const dt = new DataTransfer()
    dt.items.add(file)
    if (inputRef.current) inputRef.current.files = dt.files
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) applyFile(file)
  }

  return (
    <form action={formAction} className="space-y-4">
      {/* Drop zone / file picker */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Select or drop CSV file"
        className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-8 text-center transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-700 ${
          isDragging
            ? 'border-green-700 bg-green-50'
            : 'border-zinc-200 bg-zinc-50 hover:border-green-700/40 hover:bg-zinc-100'
        }`}
        onClick={() => inputRef.current?.click()}
        onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
        onDragEnter={e => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="mb-3 h-8 w-8 text-zinc-500"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
          />
        </svg>

        {filename ? (
          <p className="text-sm font-medium text-green-700 break-all">{filename}</p>
        ) : (
          <>
            <p className="text-sm font-medium text-zinc-300">Drop your Strong export here</p>
            <p className="mt-1 text-xs text-zinc-500">or tap to browse · CSV only</p>
          </>
        )}

        <input
          ref={inputRef}
          type="file"
          name="file"
          accept=".csv,text/csv"
          required
          className="hidden"
          onChange={e => {
            const f = e.target.files?.[0]
            if (f) applyFile(f)
          }}
        />
      </div>

      {/* Result banner */}
      {state.message && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            state.success
              ? 'border-green-600/40 bg-green-500/10 text-green-300'
              : 'border-red-600/40 bg-red-500/10 text-red-300'
          }`}
        >
          {state.message}

          {/* Stat pills on success */}
          {state.success &&
            typeof state.importedWorkouts === 'number' &&
            state.importedWorkouts > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="rounded-md bg-green-500/20 px-2 py-0.5 text-xs font-semibold text-green-200">
                  {state.importedWorkouts} workout{state.importedWorkouts !== 1 ? 's' : ''}
                </span>
                <span className="rounded-md bg-green-500/20 px-2 py-0.5 text-xs font-semibold text-green-200">
                  {state.importedSets} set{state.importedSets !== 1 ? 's' : ''}
                </span>
                {(state.skippedWorkouts ?? 0) > 0 && (
                  <span className="rounded-md bg-zinc-700/60 px-2 py-0.5 text-xs font-semibold text-zinc-300">
                    {state.skippedWorkouts} skipped
                  </span>
                )}
              </div>
            )}
        </div>
      )}

      <button
        type="submit"
        disabled={isPending || !filename}
        className="w-full rounded-xl py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        style={{ background: 'linear-gradient(135deg, #166534, #16a34a)' }}
      >
        {isPending ? (
          <span className="flex items-center justify-center gap-2">
            <svg
              className="h-4 w-4 animate-spin"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            Importing…
          </span>
        ) : (
          'Import Workouts'
        )}
      </button>
    </form>
  )
}

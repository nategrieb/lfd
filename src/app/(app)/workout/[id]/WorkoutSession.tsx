'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { cancelWorkoutDraft, deleteSet, finishWorkout, updateSet, updateWorkoutName } from '../actions'
import AddSetForm from './AddSetForm'
import VideoUpload from './VideoUpload'
import { nameToSlug } from '@/lib/lifts'
import { formatTempo, formatRest } from '@/lib/programs'
import RestTimer from './RestTimer'

type ScheduledSet = {
  id: string
  sort_order: number
  exercise_name: string
  sets_count: number
  reps: number | null
  reps_note: string | null
  calculated_weight: number | null   // pre-calculated lbs; null = RPE-based (user fills in)
  percentage: number | null
  target_rpe: number | null
  tempo: string | null
  rest_seconds: number | null
}

type WorkoutSet = {
  id: string
  exercise_name: string
  weight: number
  reps: number
  rpe: number | null
  created_at: string
  video_url: string | null
}

type WorkoutSessionProps = {
  workoutId: string
  initialWorkoutName: string
  workoutStatus: 'in_progress' | 'completed'
  initialSets: WorkoutSet[]
  liftOneRepMaxes: Record<string, number>
  scheduledSets?: ScheduledSet[]
}

function exerciseDomId(name: string) {
  return `exercise-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
}

function getOneRepMax(exerciseName: string, maxes: Record<string, number>): number | null {
  return maxes[exerciseName.toLowerCase()] ?? null
}

export default function WorkoutSession({
  workoutId,
  initialWorkoutName,
  workoutStatus,
  initialSets,
  liftOneRepMaxes,
  scheduledSets,
}: WorkoutSessionProps) {
  // Build a map from canonical lowercase exercise name → scheduled set prescription
  const scheduledSetMap = useMemo(() => {
    if (!scheduledSets?.length) return null
    const map = new Map<string, ScheduledSet>()
    for (const ss of scheduledSets) {
      map.set(ss.exercise_name.toLowerCase(), ss)
    }
    return map
  }, [scheduledSets])
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [workoutName, setWorkoutName] = useState(initialWorkoutName)
  const [draftWorkoutName, setDraftWorkoutName] = useState(initialWorkoutName)
  const [sets, setSets] = useState<WorkoutSet[]>(initialSets)
  const [setDrafts, setSetDrafts] = useState<Record<string, { weight: string; reps: string; rpe: string }>>(
    () =>
      Object.fromEntries(
        initialSets.map((set) => [
          set.id,
          {
            weight: String(set.weight),
            reps: String(set.reps),
            rpe: set.rpe !== null ? String(set.rpe) : '',
          },
        ])
      )
  )
  const [exerciseOrder, setExerciseOrder] = useState<string[]>(() => {
    const fromSets = Array.from(new Set(initialSets.map((set) => set.exercise_name).filter(Boolean)))
    // Prepend any scheduled exercises not yet logged (preserves program order)
    if (scheduledSets?.length) {
      const programNames = scheduledSets
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((ss) => ss.exercise_name)
      const extra = programNames.filter((n) => !fromSets.includes(n))
      return [...extra, ...fromSets.filter((n) => !extra.includes(n))]
    }
    return fromSets
  })
  const [newExerciseName, setNewExerciseName] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState<string | null>(null)

  const groupedSets = useMemo(() => {
    return sets.reduce<Record<string, WorkoutSet[]>>((acc, set) => {
      const exercise = set.exercise_name ?? 'Unknown'
      if (!acc[exercise]) acc[exercise] = []
      acc[exercise].push(set)
      return acc
    }, {})
  }, [sets])

  const totalSets = sets.length
  const totalVolume = useMemo(() => sets.reduce((acc, set) => acc + set.weight * set.reps, 0), [sets])
  const formattedVolume = useMemo(() => new Intl.NumberFormat('en-US').format(totalVolume), [totalVolume])

  const handleSetAdded = (set: WorkoutSet) => {
    setSets((prev) => [...prev, set])
    setExerciseOrder((prev) => (prev.includes(set.exercise_name) ? prev : [...prev, set.exercise_name]))
    setSetDrafts((prev) => ({
      ...prev,
      [set.id]: {
        weight: String(set.weight),
        reps: String(set.reps),
        rpe: set.rpe !== null ? String(set.rpe) : '',
      },
    }))
  }

  const handleDelete = async (setId: string) => {
    setIsDeleting(setId)
    const result = await deleteSet({ setId, workoutId })
    setIsDeleting(null)

    if (!result.success) {
      setMessage(result.message ?? 'Failed to delete set.')
      setTimeout(() => setMessage(null), 2500)
      return
    }

    setSets((prev) => prev.filter((set) => set.id !== setId))
    setSetDrafts((prev) => {
      const next = { ...prev }
      delete next[setId]
      return next
    })
  }

  const handleAddExercise = () => {
    const trimmed = newExerciseName.trim()
    if (!trimmed) {
      setMessage('Exercise name is required.')
      setTimeout(() => setMessage(null), 2500)
      return
    }

    const exists = exerciseOrder.some((exercise) => exercise.toLowerCase() === trimmed.toLowerCase())
    if (exists) {
      setMessage('That exercise already exists in this workout.')
      setTimeout(() => setMessage(null), 2500)
      return
    }

    setExerciseOrder((prev) => [...prev, trimmed])
    setNewExerciseName('')

    // Bring the new exercise card into view so the user can log sets immediately.
    setTimeout(() => {
      const element = document.getElementById(exerciseDomId(trimmed))
      element?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 0)
  }

  const persistAllChanges = async () => {
    const nextName = draftWorkoutName.trim()
    if (!nextName) {
      setMessage('Workout name cannot be empty.')
      setTimeout(() => setMessage(null), 2500)
      return false
    }

    if (nextName !== workoutName) {
      const nameResult = await updateWorkoutName({ workoutId, name: nextName })
      if (!nameResult.success) {
        setMessage(nameResult.message ?? 'Failed to update workout name.')
        setTimeout(() => setMessage(null), 2500)
        return false
      }
      if (nameResult.name) {
        setWorkoutName(nameResult.name)
        setDraftWorkoutName(nameResult.name)
      }
    }

    const changedSetIds = sets
      .filter((set) => {
        const draft = setDrafts[set.id]
        if (!draft) return false
        const draftRpe = draft.rpe !== '' ? Number(draft.rpe) : null
        return (
          Number(draft.weight) !== set.weight ||
          Number(draft.reps) !== set.reps ||
          draftRpe !== set.rpe
        )
      })
      .map((set) => set.id)

    if (changedSetIds.length > 0) {
      for (const setId of changedSetIds) {
        const draft = setDrafts[setId]
        const result = await updateSet({
          setId,
          workoutId,
          exerciseName: sets.find((set) => set.id === setId)?.exercise_name ?? '',
          weight: Number(draft.weight),
          reps: Number(draft.reps),
          rpe: draft.rpe !== '' ? Number(draft.rpe) : null,
        })

        if (!result.success || !result.set) {
          setMessage(result.message ?? 'Failed to update one of the sets.')
          setTimeout(() => setMessage(null), 2500)
          return false
        }

        setSets((prev) => prev.map((set) => (set.id === result.set.id ? { ...set, ...result.set } : set)))
        setSetDrafts((prev) => ({
          ...prev,
          [result.set.id]: {
            weight: String(result.set.weight),
            reps: String(result.set.reps),
            rpe: result.set.rpe != null ? String(result.set.rpe) : '',
          },
        }))
      }
    }

    setMessage(changedSetIds.length > 0 || nextName !== workoutName ? 'Changes saved.' : 'No changes to save.')
    setTimeout(() => setMessage(null), 2500)
    return true
  }

  const handleDoneEditing = () => {
    startTransition(async () => {
      const ok = await persistAllChanges()
      if (ok) {
        router.push(`/workout/${workoutId}/summary`)
      }
    })
  }

  const handleGoHistory = () => {
    startTransition(async () => {
      const ok = await persistAllChanges()
      if (ok) {
        router.push('/history')
      }
    })
  }

  const handleFinishWorkout = () => {
    startTransition(async () => {
      const ok = await persistAllChanges()
      if (!ok) return

      const formData = new FormData()
      formData.set('workout_id', workoutId)
      await finishWorkout(formData)
    })
  }

  const handleCancelDraft = () => {
    startTransition(async () => {
      const result = await cancelWorkoutDraft({ workoutId })
      if (!result.success) {
        setMessage(result.message ?? 'Unable to cancel draft.')
        setTimeout(() => setMessage(null), 2500)
        return
      }

      router.push('/')
    })
  }

  return (
    <>
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
        <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-400">Workout Name</label>
        <div className="mt-2 flex items-center gap-2">
          <input
            value={draftWorkoutName}
            onChange={(event) => setDraftWorkoutName(event.target.value)}
            maxLength={80}
            className="w-full rounded-xl border border-zinc-700 bg-zinc-950/70 px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Leg Day, Heavy Singles, etc."
          />
        </div>
      </div>

      <div className="mt-6 space-y-4">
        <p className="text-xs text-zinc-400">Add sets inside each exercise card below.</p>

        {exerciseOrder.length ? (
          exerciseOrder.map((exerciseName) => {
            const exerciseSets = groupedSets[exerciseName] ?? []
            const latestSet = exerciseSets.length ? exerciseSets[exerciseSets.length - 1] : null
            return (
            <div id={exerciseDomId(exerciseName)} key={exerciseName} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
              {(() => {
                const ss = scheduledSetMap?.get(exerciseName.toLowerCase())
                if (!ss) return null
                return (
                  <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-amber-700/30 bg-amber-900/20 px-3 py-2">
                    <span className="text-xs font-bold text-amber-400">Target</span>
                    <span className="text-xs text-amber-200">
                      {ss.sets_count}×{ss.reps ?? ss.reps_note}
                    </span>
                    {ss.calculated_weight != null ? (
                      <span className="rounded-full bg-amber-500 px-2 py-0.5 text-xs font-bold text-black">
                        {ss.calculated_weight} lbs
                      </span>
                    ) : ss.target_rpe ? (
                      <span className="rounded-full border border-amber-500 px-2 py-0.5 text-xs font-semibold text-amber-300">
                        RPE {ss.target_rpe}
                      </span>
                    ) : null}
                    {ss.percentage && (
                      <span className="text-xs text-zinc-500">@{Math.round(ss.percentage * 100)}%</span>
                    )}
                    {ss.tempo && (
                      <span className="text-xs text-zinc-500" title={formatTempo(ss.tempo)}>
                        {ss.tempo}
                      </span>
                    )}
                    {ss.rest_seconds ? (
                      <RestTimer seconds={ss.rest_seconds} label={formatRest(ss.rest_seconds)} />
                    ) : null}
                  </div>
                )
              })()}
              <div className="flex items-center justify-between">
                <div>
                  <Link
                    href={`/lifts/${nameToSlug(exerciseName)}`}
                    className="text-sm font-semibold text-white hover:text-amber-400 transition-colors"
                    onClick={e => e.stopPropagation()}
                  >
                    {exerciseName}
                  </Link>
                  <p className="text-xs text-zinc-400">
                    {exerciseSets.length} set{exerciseSets.length === 1 ? '' : 's'}
                  </p>
                </div>
                {exerciseSets.length ? (
                  <span className="text-xs text-zinc-400">
                    Latest: {new Date(exerciseSets[exerciseSets.length - 1].created_at).toLocaleTimeString()}
                  </span>
                ) : null}
              </div>

              {exerciseSets.length ? (
                <ul className="mt-4 space-y-2">
                  {exerciseSets.map((set, index) => (
                    <li
                      key={set.id}
                      className="rounded-xl border border-zinc-800 bg-zinc-950/40 px-3 py-2"
                    >
                      <div className="grid grid-cols-[22px_minmax(0,1fr)_minmax(0,1fr)_64px_36px] items-center gap-2">
                        <span className="text-xs font-medium text-zinc-400">{index + 1}</span>

                        <input
                          type="number"
                          step="0.5"
                          value={setDrafts[set.id]?.weight ?? String(set.weight)}
                          onChange={(event) =>
                            setSetDrafts((prev) => ({
                              ...prev,
                              [set.id]: { ...prev[set.id], weight: event.target.value },
                            }))
                          }
                          className="h-10 rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm text-white"
                        />
                        <input
                          type="number"
                          min="1"
                          value={setDrafts[set.id]?.reps ?? String(set.reps)}
                          onChange={(event) =>
                            setSetDrafts((prev) => ({
                              ...prev,
                              [set.id]: { ...prev[set.id], reps: event.target.value },
                            }))
                          }
                          className="h-10 rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm text-white"
                        />
                        <input
                          type="number"
                          step="0.5"
                          min="1"
                          max="10"
                          placeholder="RPE"
                          title="Rate of Perceived Exertion (1–10)"
                          value={setDrafts[set.id]?.rpe ?? ''}
                          onChange={(event) =>
                            setSetDrafts((prev) => ({
                              ...prev,
                              [set.id]: { ...prev[set.id], rpe: event.target.value },
                            }))
                          }
                          className="h-10 rounded-lg border border-zinc-700 bg-zinc-900 px-2 text-center text-sm text-white placeholder:text-zinc-600"
                        />
                        <button
                          type="button"
                          onClick={() => handleDelete(set.id)}
                          disabled={isDeleting === set.id}
                          aria-label="Delete set"
                          title="Delete set"
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-rose-500/10 text-rose-200 hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isDeleting === set.id ? (
                            <span className="text-[10px]">...</span>
                          ) : (
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.8"
                              className="h-4 w-4"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 7.5h15m-12 0V6a1.5 1.5 0 011.5-1.5h6A1.5 1.5 0 0116.5 6v1.5m-8.25 0V18A1.5 1.5 0 009.75 19.5h4.5A1.5 1.5 0 0015.75 18V7.5" />
                            </svg>
                          )}
                        </button>
                      </div>
                      <VideoUpload
                        setId={set.id}
                        workoutId={workoutId}
                        exerciseName={exerciseName}
                        weight={set.weight}
                        reps={set.reps}
                        rpe={set.rpe}
                        oneRepMax={getOneRepMax(exerciseName, liftOneRepMaxes)}
                        initialVideoUrl={set.video_url}
                      />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-sm text-zinc-400">No sets yet for this exercise.</p>
              )}

              <div className="mt-3">
                <AddSetForm
                  workoutId={workoutId}
                  exerciseName={exerciseName}
                  defaultWeight={latestSet?.weight ?? scheduledSetMap?.get(exerciseName.toLowerCase())?.calculated_weight ?? undefined}
                  defaultReps={latestSet?.reps ?? scheduledSetMap?.get(exerciseName.toLowerCase())?.reps ?? undefined}
                  onAdded={(set) => handleSetAdded({ ...set, video_url: null })}
                />
              </div>
            </div>
            )
          })
        ) : (
          <p className="text-sm text-zinc-400">No exercises yet. Add your first exercise below.</p>
        )}

        <div className="sticky bottom-24 z-20 rounded-xl border border-zinc-700 bg-zinc-950/95 p-3 backdrop-blur">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Add Exercise</p>
          <div className="mt-2 flex items-center gap-2">
            <input
              value={newExerciseName}
              onChange={(event) => setNewExerciseName(event.target.value)}
              placeholder="Example: Incline Bench"
              className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={handleAddExercise}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
            >
              Add
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {['Squat', 'Bench', 'Deadlift'].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setNewExerciseName(preset)}
                className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
              >
                {preset}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-8">
        {message ? (
          <div className="rounded-lg bg-zinc-800/70 px-4 py-3 text-sm text-zinc-200">{message}</div>
        ) : null}
      </div>

      <div className="mt-6 border-t border-zinc-800 pt-4">
        <p className="text-sm text-zinc-400">Workout total</p>
        <p className="text-3xl font-semibold">{formattedVolume} lbs</p>
        <p className="text-xs text-zinc-400">{totalSets} set{totalSets === 1 ? '' : 's'}</p>

        {workoutStatus === 'in_progress' ? (
          <div className="mt-6 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleFinishWorkout}
                disabled={isPending}
                className="rounded-xl bg-white px-5 py-3 font-semibold text-black disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPending ? 'Saving…' : 'Finish workout'}
              </button>
              {totalSets === 0 ? (
                <button
                  type="button"
                  onClick={handleCancelDraft}
                  disabled={isPending}
                  className="rounded-xl border border-rose-800 bg-rose-950/40 px-4 py-3 text-sm font-semibold text-rose-200 hover:bg-rose-900/40 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isPending ? 'Canceling…' : 'Cancel draft'}
                </button>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="mt-6 flex items-center justify-between gap-3">
            <p className="text-xs text-zinc-400">Changes will be saved when you leave this page.</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDoneEditing}
                disabled={isPending}
                className="rounded-xl border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-200 hover:bg-zinc-800"
              >
                {isPending ? 'Saving…' : 'Done Editing'}
              </button>
              <button
                type="button"
                onClick={handleGoHistory}
                disabled={isPending}
                className="rounded-xl bg-zinc-800 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700"
              >
                {isPending ? 'Saving…' : 'History'}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

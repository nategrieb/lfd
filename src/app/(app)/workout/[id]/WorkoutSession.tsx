'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { addSet, cancelWorkoutDraft, deleteSet, finishWorkout, updateSet, updateWorkoutName } from '../actions'
import AddSetForm from './AddSetForm'
import VideoUpload from './VideoUpload'
import FinishWorkoutSheet from './FinishWorkoutSheet'
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
  userId: string
  initialWorkoutName: string
  workoutStatus: 'in_progress' | 'completed'
  initialSets: WorkoutSet[]
  liftOneRepMaxes: Record<string, number>
  scheduledSets?: ScheduledSet[]
}

type PendingSet = {
  localId: string
  exerciseName: string
  weight: string   // pre-filled but editable
  reps: string
  rpe: string
}

function buildInitialPendingSets(
  scheduledSets: ScheduledSet[] | undefined,
  initialSets: WorkoutSet[],
): PendingSet[] {
  if (!scheduledSets?.length) return []

  // Count already-logged sets per exercise
  const loggedCount: Record<string, number> = {}
  for (const s of initialSets) {
    const key = s.exercise_name.toLowerCase()
    loggedCount[key] = (loggedCount[key] ?? 0) + 1
  }

  const skipRemaining: Record<string, number> = { ...loggedCount }
  const result: PendingSet[] = []
  const sorted = [...scheduledSets].sort((a, b) => a.sort_order - b.sort_order)

  for (const ss of sorted) {
    const key = ss.exercise_name.toLowerCase()
    const skip = skipRemaining[key] ?? 0

    if (skip >= ss.sets_count) {
      skipRemaining[key] = skip - ss.sets_count
      continue
    }

    const startFrom = skip
    skipRemaining[key] = 0

    for (let i = startFrom; i < ss.sets_count; i++) {
      result.push({
        localId: `${ss.id}-${i}`,
        exerciseName: ss.exercise_name,
        weight: ss.calculated_weight != null ? String(ss.calculated_weight) : '',
        reps: ss.reps != null ? String(ss.reps) : '',
        rpe: ss.target_rpe != null ? String(ss.target_rpe) : '',
      })
    }
  }

  return result
}

function exerciseDomId(name: string) {
  return `exercise-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
}

function getOneRepMax(exerciseName: string, maxes: Record<string, number>): number | null {
  return maxes[exerciseName.toLowerCase()] ?? null
}

export default function WorkoutSession({
  workoutId,
  userId,
  initialWorkoutName,
  workoutStatus,
  initialSets,
  liftOneRepMaxes,
  scheduledSets,
}: WorkoutSessionProps) {
  // Build a map from canonical lowercase exercise name → all scheduled set groups (in order)
  const scheduledSetGroupsMap = useMemo(() => {
    if (!scheduledSets?.length) return null
    const map = new Map<string, ScheduledSet[]>()
    const sorted = [...scheduledSets].sort((a, b) => a.sort_order - b.sort_order)
    for (const ss of sorted) {
      const key = ss.exercise_name.toLowerCase()
      const existing = map.get(key) ?? []
      existing.push(ss)
      map.set(key, existing)
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
      const programNames = Array.from(new Set(
        scheduledSets
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((ss) => ss.exercise_name)
      ))
      const extra = programNames.filter((n) => !fromSets.includes(n))
      return [...extra, ...fromSets.filter((n) => !extra.includes(n))]
    }
    return fromSets
  })

  // Pending sets: pre-filled from program prescription, confirmed one-by-one by the user
  const [pendingSets, setPendingSets] = useState<PendingSet[]>(() =>
    buildInitialPendingSets(scheduledSets, initialSets)
  )
  const [pendingDrafts, setPendingDrafts] = useState<Record<string, { weight: string; reps: string; rpe: string }>>(() =>
    Object.fromEntries(
      buildInitialPendingSets(scheduledSets, initialSets).map((p) => [
        p.localId,
        { weight: p.weight, reps: p.reps, rpe: p.rpe },
      ])
    )
  )
  const [confirmingLocalId, setConfirmingLocalId] = useState<string | null>(null)
  const [newExerciseName, setNewExerciseName] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const [showFinishSheet, setShowFinishSheet] = useState(false)

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

  const handleConfirmPending = async (localId: string) => {
    const pending = pendingSets.find((p) => p.localId === localId)
    if (!pending) return
    const draft = pendingDrafts[localId]
    if (!draft) return

    const weight = Number(draft.weight)
    const reps = Number(draft.reps)
    if (!draft.weight || !draft.reps || Number.isNaN(weight) || weight <= 0 || Number.isNaN(reps) || reps <= 0) {
      setMessage('Enter weight and reps before confirming.')
      setTimeout(() => setMessage(null), 2500)
      return
    }

    setConfirmingLocalId(localId)
    const formData = new FormData()
    formData.set('workout_id', workoutId)
    formData.set('exercise_name', pending.exerciseName)
    formData.set('weight', draft.weight)
    formData.set('reps', draft.reps)
    if (draft.rpe) formData.set('rpe', draft.rpe)

    const result = await addSet(formData)
    setConfirmingLocalId(null)

    if (!result.success || !result.set) {
      setMessage(result.message ?? 'Failed to confirm set.')
      setTimeout(() => setMessage(null), 2500)
      return
    }

    handleSetAdded({ ...result.set, video_url: null })
    setPendingSets((prev) => prev.filter((p) => p.localId !== localId))
    setPendingDrafts((prev) => {
      const next = { ...prev }
      delete next[localId]
      return next
    })
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
    setShowFinishSheet(true)
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
      {showFinishSheet && (
        <FinishWorkoutSheet
          workoutId={workoutId}
          userId={userId}
          onClose={() => setShowFinishSheet(false)}
          onBeforeFinish={persistAllChanges}
        />
      )}
      <div className="rounded-xl border border-zinc-100 bg-white p-4 shadow-sm">
        <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-400">Workout Name</label>
        <div className="mt-2 flex items-center gap-2">
          <input
            value={draftWorkoutName}
            onChange={(event) => setDraftWorkoutName(event.target.value)}
            maxLength={80}
            className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-green-700"
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
            <div id={exerciseDomId(exerciseName)} key={exerciseName} className="rounded-xl border border-zinc-100 bg-white p-4 shadow-sm">
              {(() => {
                const groups = scheduledSetGroupsMap?.get(exerciseName.toLowerCase())
                if (!groups?.length) return null
                return (
                  <div className="mb-3 rounded-lg border border-green-700/20 bg-green-50 px-3 py-2.5">
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-green-700">Target</p>
                    <div className="space-y-2">
                      {groups.map((ss, gi) => (
                        <div key={gi}>
                          {gi > 0 && (
                            <div className="mb-2 flex items-center gap-2">
                              <div className="h-px flex-1 bg-green-200" />
                              <span className="text-[10px] font-medium uppercase tracking-wider text-green-600">then</span>
                              <div className="h-px flex-1 bg-green-200" />
                            </div>
                          )}
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="text-sm font-bold text-green-800">
                              {ss.sets_count}×{ss.reps ?? ss.reps_note}
                            </span>
                            {ss.calculated_weight != null ? (
                              <span className="rounded-full px-2 py-0.5 text-xs font-bold text-white" style={{ background: 'linear-gradient(135deg, #166534, #16a34a)' }}>
                                {ss.calculated_weight} lbs
                              </span>
                            ) : ss.target_rpe ? (
                              <span className="rounded-full border border-green-700 px-2 py-0.5 text-xs font-semibold text-green-700">
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
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })()}
              <div className="flex items-center justify-between">
                <div>
                  <Link
                    href={`/lifts/${nameToSlug(exerciseName)}`}
                    className="text-sm font-semibold text-zinc-900 hover:text-green-700 transition-colors"
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
                      className="rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2"
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
                          className="h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900"
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
                          className="h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900"
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
                          className="h-10 rounded-lg border border-zinc-200 bg-white px-2 text-center text-sm text-zinc-900 placeholder:text-zinc-300"
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
              ) : null}

              {/* Pending sets — pre-filled from program, confirmed one by one */}
              {(() => {
                const myPending = pendingSets.filter(
                  (p) => p.exerciseName.toLowerCase() === exerciseName.toLowerCase()
                )
                if (!myPending.length) return null
                return (
                  <ul className={`${exerciseSets.length > 0 ? 'mt-4 border-t border-zinc-800 pt-3' : 'mt-2'} space-y-2`}>
                    {myPending.map((p, index) => {
                      const draft = pendingDrafts[p.localId] ?? { weight: p.weight, reps: p.reps, rpe: p.rpe }
                      const isConfirming = confirmingLocalId === p.localId
                      const setNum = exerciseSets.length + index + 1
                      return (
                        <li key={p.localId} className="rounded-lg border border-green-200 bg-green-50 px-3 py-2">
                          <div className="grid grid-cols-[22px_minmax(0,1fr)_minmax(0,1fr)_64px_36px] items-center gap-2">
                            <span className="text-xs font-semibold text-green-700">{setNum}</span>
                            <input
                              type="number"
                              step="0.5"
                              placeholder="lbs"
                              value={draft.weight}
                              onChange={(e) =>
                                setPendingDrafts((prev) => ({
                                  ...prev,
                                  [p.localId]: { ...prev[p.localId], weight: e.target.value },
                                }))
                              }
                              className="h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-300"
                            />
                            <input
                              type="number"
                              min="1"
                              placeholder="reps"
                              value={draft.reps}
                              onChange={(e) =>
                                setPendingDrafts((prev) => ({
                                  ...prev,
                                  [p.localId]: { ...prev[p.localId], reps: e.target.value },
                                }))
                              }
                              className="h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-300"
                            />
                            <input
                              type="number"
                              step="0.5"
                              min="1"
                              max="10"
                              placeholder="RPE"
                              title="Rate of Perceived Exertion (1–10)"
                              value={draft.rpe}
                              onChange={(e) =>
                                setPendingDrafts((prev) => ({
                                  ...prev,
                                  [p.localId]: { ...prev[p.localId], rpe: e.target.value },
                                }))
                              }
                              className="h-10 rounded-lg border border-zinc-200 bg-white px-2 text-center text-sm text-zinc-900 placeholder:text-zinc-300"
                            />
                            <button
                              type="button"
                              onClick={() => handleConfirmPending(p.localId)}
                              disabled={isConfirming}
                              aria-label="Confirm set"
                              title="Log this set"
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-white hover:opacity-90 active:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
                              style={{ background: 'linear-gradient(135deg, #166534, #16a34a)' }}
                            >
                              {isConfirming ? (
                                <span className="text-[10px]">…</span>
                              ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" className="h-4 w-4">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                </svg>
                              )}
                            </button>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )
              })()}

              {exerciseSets.length === 0 && pendingSets.filter((p) => p.exerciseName.toLowerCase() === exerciseName.toLowerCase()).length === 0 ? (
                <p className="mt-4 text-sm text-zinc-400">No sets yet for this exercise.</p>
              ) : null}

              <div className="mt-3">
                <AddSetForm
                  workoutId={workoutId}
                  exerciseName={exerciseName}
                  defaultWeight={latestSet?.weight ?? undefined}
                  defaultReps={latestSet?.reps ?? undefined}
                  onAdded={(set) => handleSetAdded({ ...set, video_url: null })}
                />
              </div>
            </div>
            )
          })
        ) : (
          <p className="text-sm text-zinc-400">No exercises yet. Add your first exercise below.</p>
        )}

        <div className="sticky bottom-24 z-20 rounded-xl border border-zinc-100 bg-white/95 p-3 shadow-sm backdrop-blur">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Add Exercise</p>
          <div className="mt-2 flex items-center gap-2">
            <input
              value={newExerciseName}
              onChange={(event) => setNewExerciseName(event.target.value)}
              placeholder="Example: Incline Bench"
              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-green-700"
            />
            <button
              type="button"
              onClick={handleAddExercise}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #166534, #16a34a)' }}
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
                className="rounded-full border border-zinc-200 px-3 py-1 text-xs text-zinc-600 hover:bg-zinc-50"
              >
                {preset}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-8">
        {message ? (
          <div className="rounded-lg bg-zinc-100 px-4 py-3 text-sm text-zinc-700">{message}</div>
        ) : null}
      </div>

      <div className="mt-6 border-t border-zinc-100 pt-4">
        <p className="text-sm text-zinc-500">Workout total</p>
        <p className="text-3xl font-semibold text-zinc-900">{formattedVolume} lbs</p>
        <p className="text-xs text-zinc-400">{totalSets} set{totalSets === 1 ? '' : 's'}</p>

        {workoutStatus === 'in_progress' ? (
          <div className="mt-6 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleFinishWorkout}
                disabled={isPending}
                className="rounded-xl px-5 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg, #166534, #16a34a)' }}>
                {isPending ? 'Saving…' : 'Finish workout'}
              </button>
              {totalSets === 0 ? (
                <button
                  type="button"
                  onClick={handleCancelDraft}
                  disabled={isPending}
                  className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-600 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
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
                className="rounded-xl border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
              >
                {isPending ? 'Saving…' : 'Done Editing'}
              </button>
              <button
                type="button"
                onClick={handleGoHistory}
                disabled={isPending}
                className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-100"
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

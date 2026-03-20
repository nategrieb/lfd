'use client'

import { useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { addSet, cancelWorkoutDraft, deleteSet, finishWorkout, updateSet, updateWorkoutDetails, updateWorkoutName } from '../actions'
import AddSetForm from './AddSetForm'
import VideoUpload from './VideoUpload'
import FinishWorkoutSheet from './FinishWorkoutSheet'
import { createClient } from '@/lib/supabase'
import { nameToSlug } from '@/lib/lifts'
import { formatTempo, formatRest } from '@/lib/programs'
import { isCardioSet, formatCardioDistance, formatCardioDuration } from '@/lib/feed'
import RestTimer from './RestTimer'
import WorkoutVideoReelModal from '@/components/WorkoutVideoReelModal'

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
  distance_m?: number | null
  duration_seconds?: number | null
}

type WorkoutSessionProps = {
  workoutId: string
  userId: string
  initialWorkoutName: string
  workoutStatus: 'in_progress' | 'completed'
  initialSets: WorkoutSet[]
  liftOneRepMaxes: Record<string, number>
  scheduledSets?: ScheduledSet[]
  initialLocation?: string | null
  initialPostPhotos?: string[] | null
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
  initialLocation,
  initialPostPhotos,
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
  const [lastAddedExercise, setLastAddedExercise] = useState<string | null>(null)
  const [draftLocation, setDraftLocation] = useState(initialLocation ?? '')
  const [existingPhotos, setExistingPhotos] = useState<string[]>(initialPostPhotos ?? [])
  const [newPhotoFiles, setNewPhotoFiles] = useState<File[]>([])
  const [newPhotoPreviews, setNewPhotoPreviews] = useState<string[]>([])
  const [reelStartIndex, setReelStartIndex] = useState<number | null>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)

  const removeExistingPhoto = (index: number) => {
    setExistingPhotos((prev) => prev.filter((_, i) => i !== index))
  }
  const removeNewPhoto = (index: number) => {
    const next = newPhotoFiles.filter((_, i) => i !== index)
    setNewPhotoFiles(next)
    setNewPhotoPreviews(next.map((f) => URL.createObjectURL(f)))
  }
  const handleNewPhotoAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const incoming = Array.from(e.target.files ?? [])
    if (!incoming.length) return
    const maxNew = 5 - existingPhotos.length
    const combined = [...newPhotoFiles, ...incoming].slice(0, maxNew)
    setNewPhotoFiles(combined)
    setNewPhotoPreviews(combined.map((f) => URL.createObjectURL(f)))
    e.target.value = ''
  }

  const groupedSets = useMemo(() => {
    return sets.reduce<Record<string, WorkoutSet[]>>((acc, set) => {
      const exercise = set.exercise_name ?? 'Unknown'
      if (!acc[exercise]) acc[exercise] = []
      acc[exercise].push(set)
      return acc
    }, {})
  }, [sets])

  const workoutClips = useMemo(() => {
    const clips: Array<{ id: string; src: string; title: string; subtitle: string }> = []
    const countByExercise: Record<string, number> = {}
    for (const set of sets) {
      if (!set.video_url) continue
      const key = set.exercise_name
      countByExercise[key] = (countByExercise[key] ?? 0) + 1
      const setNum = countByExercise[key]
      clips.push({
        id: set.id,
        src: set.video_url,
        title: `${set.exercise_name} · Set ${setNum}`,
        subtitle: isCardioSet(set as any)
          ? [formatCardioDistance(set.distance_m ?? 0), formatCardioDuration(set.duration_seconds ?? 0)].filter(Boolean).join(' · ')
          : `${set.weight} lbs × ${set.reps}${set.rpe != null ? ` · RPE ${set.rpe}` : ''}`,

      })
    }
    return clips
  }, [sets])

  const openReelAtSet = (setId: string) => {
    const idx = workoutClips.findIndex((clip) => clip.id === setId)
    if (idx >= 0) setReelStartIndex(idx)
  }

  const totalSets = sets.length
  const totalVolume = useMemo(() => sets.filter(s => !isCardioSet(s as any)).reduce((acc, set) => acc + set.weight * set.reps, 0), [sets])
  const totalDistanceM = useMemo(() => sets.filter(s => isCardioSet(s as any)).reduce((acc, s) => acc + (s.distance_m ?? 0), 0), [sets])
  const totalCardioSeconds = useMemo(() => sets.filter(s => isCardioSet(s as any)).reduce((acc, s) => acc + (s.duration_seconds ?? 0), 0), [sets])
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
    setLastAddedExercise(trimmed)

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

    if (workoutStatus === 'completed') {
      const uploadedUrls: string[] = []
      if (newPhotoFiles.length > 0) {
        const supabase = createClient()
        const timestamp = Date.now()
        for (let i = 0; i < newPhotoFiles.length; i++) {
          const file = newPhotoFiles[i]
          const ext = file.name.split('.').pop() ?? 'jpg'
          const path = `${userId}/${workoutId}/${timestamp}-${i}.${ext}`
          const { error: uploadError } = await supabase.storage
            .from('workout-post-photos')
            .upload(path, file, { upsert: true, contentType: file.type })
          if (!uploadError) {
            const { data: urlData } = supabase.storage
              .from('workout-post-photos')
              .getPublicUrl(path)
            uploadedUrls.push(urlData.publicUrl)
          }
        }
      }
      const allPhotos = [...existingPhotos, ...uploadedUrls]
      const detailsResult = await updateWorkoutDetails({
        workoutId,
        location: draftLocation.trim() || null,
        postPhotos: allPhotos,
      })
      if (!detailsResult.success) {
        setMessage(detailsResult.message ?? 'Failed to save details.')
        setTimeout(() => setMessage(null), 2500)
        return false
      }
      setNewPhotoFiles([])
      setNewPhotoPreviews([])
      setExistingPhotos(allPhotos)
    }

    setMessage('Changes saved.')
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
      {reelStartIndex !== null && workoutClips.length > 0 && (
        <WorkoutVideoReelModal
          clips={workoutClips}
          initialIndex={reelStartIndex}
          onClose={() => setReelStartIndex(null)}
        />
      )}
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

      {workoutStatus === 'completed' && (
        <div className="rounded-xl border border-zinc-100 bg-white p-4 shadow-sm">
          <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-zinc-400">Details</p>

          {/* Location */}
          <div className="mb-5">
            <label className="mb-1.5 block text-sm font-semibold text-zinc-800">Location</label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-zinc-400">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
                  <path fillRule="evenodd" d="M9.69 18.933l.003.001C9.89 19.02 10 19 10 19s.11.02.308-.066l.002-.001.006-.003.018-.008a5.741 5.741 0 00.281-.145 13.39 13.39 0 002.206-1.72C14.047 15.497 16 12.51 16 9.5a6 6 0 00-12 0c0 3.01 1.953 5.998 3.168 7.307a13.39 13.39 0 002.523 1.865zm-.004-12.183a2.25 2.25 0 113.182 3.182 2.25 2.25 0 01-3.182-3.182z" clipRule="evenodd" />
                </svg>
              </span>
              <input
                type="text"
                value={draftLocation}
                onChange={(e) => setDraftLocation(e.target.value)}
                placeholder="Gym, home gym, etc."
                maxLength={100}
                className="w-full rounded-xl border border-zinc-200 bg-white py-2.5 pl-9 pr-4 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-green-700"
              />
            </div>
          </div>

          {/* Photos */}
          <div>
            <label className="mb-2 block text-sm font-semibold text-zinc-800">Photos</label>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              onChange={handleNewPhotoAdd}
            />
            <div className="grid grid-cols-3 gap-2">
              {existingPhotos.map((src, i) => (
                <div key={src} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt={`Photo ${i + 1}`} className="aspect-square w-full rounded-xl object-cover" />
                  <button
                    type="button"
                    onClick={() => removeExistingPhoto(i)}
                    aria-label="Remove photo"
                    className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-zinc-800 text-white shadow-md hover:bg-rose-600"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
                      <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                    </svg>
                  </button>
                </div>
              ))}
              {newPhotoPreviews.map((src, i) => (
                <div key={`new-${i}`} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt={`New photo ${i + 1}`} className="aspect-square w-full rounded-xl object-cover opacity-80 ring-2 ring-green-400" />
                  <button
                    type="button"
                    onClick={() => removeNewPhoto(i)}
                    aria-label="Remove photo"
                    className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-zinc-800 text-white shadow-md hover:bg-rose-600"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
                      <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                    </svg>
                  </button>
                </div>
              ))}
              {existingPhotos.length + newPhotoFiles.length < 5 && (
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  className="flex aspect-square items-center justify-center rounded-xl border-2 border-dashed border-zinc-200 text-zinc-400 hover:border-green-400 hover:text-green-600 transition-colors"
                  aria-label="Add photo"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                </button>
              )}
            </div>
            {existingPhotos.length + newPhotoFiles.length >= 5 && (
              <p className="mt-1.5 text-xs text-zinc-400">Maximum 5 photos</p>
            )}
          </div>
        </div>
      )}

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
                      {(() => {
                        const draft = setDrafts[set.id]
                        const draftWeight = Number(draft?.weight)
                        const draftReps = Number(draft?.reps)
                        const draftRpe = draft?.rpe != null && draft.rpe !== '' ? Number(draft.rpe) : null

                        const weightForVideo = !Number.isNaN(draftWeight) && draftWeight > 0 ? draftWeight : set.weight
                        const repsForVideo = !Number.isNaN(draftReps) && draftReps > 0 ? draftReps : set.reps
                        const rpeForVideo = draftRpe != null && !Number.isNaN(draftRpe) ? draftRpe : set.rpe

                        return (
                          <>
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
                        weight={weightForVideo}
                        reps={repsForVideo}
                        rpe={rpeForVideo}
                        oneRepMax={getOneRepMax(exerciseName, liftOneRepMaxes)}
                        distanceM={set.distance_m ?? null}
                        durationSeconds={set.duration_seconds ?? null}
                        initialVideoUrl={set.video_url}
                        onOpenReel={() => openReelAtSet(set.id)}
                        onVideoUrlChange={(url) => {
                          setSets((prev) => prev.map((s) => (s.id === set.id ? { ...s, video_url: url } : s)))
                        }}
                      />
                          </>
                        )
                      })()}
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
                  defaultRpe={latestSet?.rpe ?? undefined}
                  autoOpen={lastAddedExercise === exerciseName}
                  onAdded={(set) => { handleSetAdded({ ...set, video_url: null }); setLastAddedExercise(null) }}
                />
              </div>
            </div>
            )
          })
        ) : (
          <p className="text-sm text-zinc-400">No exercises yet. Add your first exercise below.</p>
        )}

        <div className="sticky bottom-24 z-20 rounded-xl border border-zinc-100 bg-white/95 p-3 shadow-sm backdrop-blur">
          {workoutStatus === 'completed' && (
            <>
              <button
                type="button"
                onClick={handleDoneEditing}
                disabled={isPending}
                className="mb-3 w-full rounded-xl py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg, #166534, #16a34a)' }}
              >
                {isPending ? 'Saving…' : 'Done Editing'}
              </button>
              <div className="mb-3 h-px bg-zinc-100" />
            </>
          )}
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

      <div className="mt-4 border-t border-zinc-100 pt-4">
        {message && (
          <div className="mb-3 rounded-lg bg-zinc-100 px-4 py-3 text-sm text-zinc-700">{message}</div>
        )}
        <p className="text-sm text-zinc-500">Workout total</p>
        {totalVolume > 0 && (
          <p className="text-3xl font-semibold text-zinc-900">{formattedVolume} lbs</p>
        )}
        {totalDistanceM > 0 && (
          <p className="text-3xl font-semibold text-zinc-900">{formatCardioDistance(totalDistanceM)}{totalCardioSeconds > 0 ? ` · ${formatCardioDuration(totalCardioSeconds)}` : ''}</p>
        )}
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
        ) : null}
      </div>
    </>
  )
}

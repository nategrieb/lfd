import type { SupabaseClient } from '@supabase/supabase-js'
import { canonicalName, slugToCanonical, epley1RM } from '@/lib/lifts'
import { plainSlug } from '@/lib/exercise-catalogue'
import type { ChartPoint } from '@/app/(app)/lifts/[slug]/LiftChart'
import type { VideoClip } from '@/app/(app)/lifts/[slug]/LiftVideoSection'

// The app's clients are bound to the lfd schema, so accept any schema.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = SupabaseClient<any, any, any>

export type LiftSet = {
  id: string
  exercise_name: string
  weight: number
  reps: number
  rpe: number | null
  video_url: string | null
  thumbnail_url: string | null
  workout_id: string
  workout: { id: string; name: string | null; created_at: string } | null
}

export type LiftSession = {
  workoutId: string
  workoutName: string | null
  workoutDate: string
  sets: LiftSet[]
  bestSet: LiftSet
  bestE1RM: number | null
}

export type CatalogueExercise = {
  id: string
  name: string
  equipment: string | null
  primary_muscles: string[] | null
  secondary_muscles: string[] | null
  images: string[] | null
}

export type LiftHistory = {
  title: string
  catalogueExercise: CatalogueExercise | null
  /** Newest first. */
  sessions: LiftSession[]
  chartData: ChartPoint[]
  videoClips: VideoClip[]
  prWeight: number
  prReps: number
  prE1RM: number
  setCount: number
}

export type LiftHistoryResult =
  | { kind: 'ok'; history: LiftHistory }
  /** The sets live under a catalogue exercise with a different slug. */
  | { kind: 'redirect'; slug: string }
  | { kind: 'empty' }

const SET_COLUMNS = 'id, exercise_name, weight, reps, rpe, video_url, thumbnail_url, workout_id, workout:workouts(id, name, created_at)'

/**
 * One person's history for one lift: every session, the best set in each, the progress line and all-time bests.
 * Works with a signed-in client or the public anonymous one (completed workouts are readable by both).
 */
export async function loadLiftHistory(
  supabase: Client,
  { slug, userId, allowEmpty }: { slug: string; userId: string; allowEmpty: boolean },
): Promise<LiftHistoryResult> {
  // Catalogue exercise (e.g. /lifts/barbell-bench-press-medium-grip): history is every set linked to it,
  // however it was originally named. Otherwise fall back to name-based grouping for unlinked exercises.
  const { data: catalogue } = await supabase
    .from('exercises')
    .select('id, name, equipment, primary_muscles, secondary_muscles, images')
    .eq('slug', slug)
    .maybeSingle()
  const catalogueExercise = (catalogue as CatalogueExercise | null) ?? null

  let title: string
  let rawSets: unknown[] | null

  if (catalogueExercise) {
    title = catalogueExercise.name
    const { data } = await supabase
      .from('sets')
      .select(SET_COLUMNS)
      .eq('user_id', userId)
      .eq('exercise_id', catalogueExercise.id)
      .order('created_at', { ascending: true })
    rawSets = data
  } else {
    const { data: nameRows } = await supabase.from('sets').select('exercise_name').eq('user_id', userId)
    const allNames = [...new Set((nameRows ?? []).map((r: { exercise_name: string }) => r.exercise_name))]
    title = slugToCanonical(slug)

    // Names that normalise to the same canonical (or whose own slug is this one)
    const matchingNames = allNames.filter((n) => canonicalName(n) === title || plainSlug(n) === slug)
    if (matchingNames.length === 0 && !allowEmpty) return { kind: 'empty' }

    // If those sets were linked to a catalogue exercise, that page is the real one.
    const { data: linked } = await supabase
      .from('sets')
      .select('exercise:exercises(slug)')
      .eq('user_id', userId)
      .in('exercise_name', matchingNames)
      .not('exercise_id', 'is', null)
      .limit(1)
    const linkedSlug = (linked?.[0] as { exercise: { slug: string } | null } | undefined)?.exercise?.slug
    if (linkedSlug && linkedSlug !== slug) return { kind: 'redirect', slug: linkedSlug }

    const { data } = await supabase
      .from('sets')
      .select(SET_COLUMNS)
      .eq('user_id', userId)
      .in('exercise_name', matchingNames)
      .order('created_at', { ascending: true })
    rawSets = data
  }

  const sets = (rawSets ?? []) as unknown as LiftSet[]
  if (sets.length === 0 && !catalogueExercise && !allowEmpty) return { kind: 'empty' }

  // Group by workout session
  const sessionMap = new Map<string, LiftSession>()
  for (const set of sets) {
    const wid = set.workout_id
    if (!sessionMap.has(wid)) {
      sessionMap.set(wid, {
        workoutId: wid,
        workoutName: set.workout?.name ?? null,
        workoutDate: set.workout?.created_at ?? '',
        sets: [],
        bestSet: set,
        bestE1RM: null,
      })
    }
    const session = sessionMap.get(wid)!
    session.sets.push(set)
    const e1rm = epley1RM(set.weight, set.reps)
    if (e1rm !== null && (session.bestE1RM === null || e1rm > session.bestE1RM)) {
      session.bestE1RM = e1rm
      session.bestSet = set
    }
  }

  const sessions = [...sessionMap.values()].sort((a, b) => b.workoutDate.localeCompare(a.workoutDate))

  const chartData: ChartPoint[] = [...sessionMap.values()]
    .sort((a, b) => a.workoutDate.localeCompare(b.workoutDate))
    .map((s) => ({ date: s.workoutDate, e1rm: s.bestE1RM ?? s.bestSet.weight, weight: s.bestSet.weight, reps: s.bestSet.reps }))

  let prWeight = 0
  let prReps = 1
  let prE1RM = 0
  for (const set of sets) {
    if (set.weight > prWeight || (set.weight === prWeight && set.reps > prReps)) {
      prWeight = set.weight
      prReps = set.reps
    }
    const e = epley1RM(set.weight, set.reps) ?? set.weight
    if (e > prE1RM) prE1RM = e
  }

  const videoClips: VideoClip[] = sessions.flatMap((s) =>
    s.sets
      .filter((set) => set.video_url)
      .map((set) => ({
        src: set.video_url!,
        thumbnail: set.thumbnail_url,
        title: `${set.weight} lbs × ${set.reps}`,
        weight: set.weight,
        reps: set.reps,
        date: new Date(s.workoutDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
      })),
  )

  return { kind: 'ok', history: { title, catalogueExercise, sessions, chartData, videoClips, prWeight, prReps, prE1RM, setCount: sets.length } }
}

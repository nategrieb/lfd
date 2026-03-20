/**
 * Feed scoring algorithm for LFD.
 *
 * Each completed workout is scored by its single best set, then ranked.
 * The scoring weights are tuned so that:
 *   - A video guarantees a card appears near the top.
 *   - High RPE and high %1RM contribute independently, so a max-effort lift
 *     without video still surfaces.
 *   - Recency decays exponentially (×0.90 per day) so 2-week-old content
 *     keeps ~23% of its raw score.
 *
 * Extension points (future badges / boosts):
 *   - Callers can push string labels into FeedItem.extraBadges before render.
 *   - King-Of-Lift, location PR, streak badges: inject +BONUS into rawScore
 *     via the `extraBoost` param on buildFeedItem (or post-process the array).
 *   - Friends feed: pass workouts from followed users alongside the current
 *     user — the algorithm is user-agnostic, scoring only set signals.
 */

export type FeedSet = {
  id: string
  exercise_name: string
  weight: number
  reps: number
  rpe: number | null
  video_url: string | null
  created_at?: string
}

export type MediaItem =
  | { kind: 'video'; url: string; label: string }
  | { kind: 'photo'; url: string }

export type FeedWorkout = {
  id: string
  name: string | null
  created_at: string
  user_id: string
  sets: FeedSet[]
  post_photos?: string[] | null
}

export type FeedItem = {
  workout: FeedWorkout
  /**
   * The highest-scored set for this workout — drives the displayed exercise
   * name, weight, reps, RPE, and %1RM text regardless of whether it has a video.
   */
  highlightSet: FeedSet
  /**
   * The highest-scored set that has a video_url, or null if no set in this
   * workout has been filmed. Kept separate so the algorithm can surface the
   * best filmed effort even when a different (unfilmed) set scored higher.
   */
  videoSet: FeedSet | null
  /** Final score after recency decay — used for sort order only. */
  score: number
  /** Rounded percentage of 1RM for the highlight set, or null if no 1RM on file. */
  pctOneRepMax: number | null
  /**
   * Extensible badge list rendered on the card.
   * Callers can append labels (e.g. 'King Of Lift', 'Location PR') after
   * calling buildFeed().
   */
  extraBadges: string[]
  /** Best set per distinct exercise, sorted by score — drives the multi-lift display. */
  topSetsByExercise: Array<{ set: FeedSet; pctOneRepMax: number | null }>
  /** All media to show in the carousel: one video per exercise + post photos. */
  mediaItems: MediaItem[]
}

// ─── Scoring weights ────────────────────────────────────────────────────────

const WEIGHT_VIDEO = 40

const RPE_WEIGHTS: [number, number][] = [
  [10, 30],
  [9, 22],
  [8, 14],
  [7, 6],
]

const PCT_WEIGHTS: [number, number][] = [
  [0.95, 40],
  [0.90, 28],
  [0.85, 18],
  [0.80, 10],
  [0.75, 4],
]

const DECAY_BASE = 0.90 // per day

// ─── Core scoring ───────────────────────────────────────────────────────────

function scoreSet(
  set: FeedSet,
  liftsMap: Record<string, number>,
): { rawScore: number; pct: number | null } {
  let raw = 0

  if (set.video_url) raw += WEIGHT_VIDEO

  if (set.rpe !== null) {
    for (const [threshold, pts] of RPE_WEIGHTS) {
      if (set.rpe >= threshold) { raw += pts; break }
    }
  }

  const orm = liftsMap[set.exercise_name.toLowerCase()]
  let pct: number | null = null
  if (orm && orm > 0) {
    pct = set.weight / orm
    for (const [threshold, pts] of PCT_WEIGHTS) {
      if (pct >= threshold) { raw += pts; break }
    }
  }

  return { rawScore: raw, pct }
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Builds a ranked feed from a list of completed workouts.
 *
 * @param workouts  Completed workouts, each with their sets pre-loaded.
 * @param liftsMap  Record<lowerCaseExerciseName, oneRepMaxLbs> for the viewer.
 * @param now       Injectable for testing; defaults to Date.now().
 */
export function buildFeed(
  workouts: FeedWorkout[],
  liftsMap: Record<string, number>,
  now = new Date(),
): FeedItem[] {
  const items: FeedItem[] = []

  for (const workout of workouts) {
    if (!workout.sets.length) continue

    const workoutDate = new Date(workout.created_at)
    const daysOld = Math.max(0, (now.getTime() - workoutDate.getTime()) / 86_400_000)
    const decay = Math.pow(DECAY_BASE, daysOld)

    let highlightSet: FeedSet | null = null
    let bestFinal = -Infinity
    let highlightPct: number | null = null

    // Track the best-scored SET THAT HAS VIDEO independently.
    // This means a max-effort unfilmed set still drives the text while the
    // best available video is always shown when one exists.
    let videoSet: FeedSet | null = null
    let bestVideoFinal = -Infinity

    // Best set per distinct exercise (for multi-lift display and per-exercise videos)
    const bestByExercise = new Map<string, { set: FeedSet; pct: number | null; score: number }>()

    for (const set of workout.sets) {
      const { rawScore, pct } = scoreSet(set, liftsMap)
      const final = rawScore * decay

      if (final > bestFinal) {
        bestFinal = final
        highlightSet = set
        highlightPct = pct
      }

      if (set.video_url && final > bestVideoFinal) {
        bestVideoFinal = final
        videoSet = set
      }

      const key = set.exercise_name.toLowerCase()
      const existing = bestByExercise.get(key)
      if (!existing || final > existing.score) {
        bestByExercise.set(key, { set, pct, score: final })
      }
    }

    if (!highlightSet) continue

    const topSetsByExercise = Array.from(bestByExercise.values())
      .sort((a, b) => b.score - a.score)
      .map(({ set, pct }) => ({
        set,
        pctOneRepMax: pct != null ? Math.round(pct * 100) : null,
      }))

    const mediaItems: MediaItem[] = [
      ...topSetsByExercise
        .filter(({ set }) => set.video_url)
        .map(({ set }) => ({
          kind: 'video' as const,
          url: set.video_url!,
          label: `${set.exercise_name} · ${set.weight} lbs × ${set.reps}`,
        })),
      ...(workout.post_photos ?? []).map(url => ({ kind: 'photo' as const, url })),
    ]

    const extraBadges: string[] = []
    // Future: push 'King Of Lift', 'Location PR', '🔥 Streak' etc. here

    items.push({
      workout,
      highlightSet,
      videoSet,
      score: bestFinal,
      pctOneRepMax: highlightPct != null ? Math.round(highlightPct * 100) : null,
      extraBadges,
      topSetsByExercise,
      mediaItems,
    })
  }

  // Rank highest score first.
  items.sort((a, b) => b.score - a.score)

  return items
}

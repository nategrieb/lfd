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
}

export type FeedWorkout = {
  id: string
  name: string | null
  created_at: string
  user_id: string
  sets: FeedSet[]
}

export type FeedItem = {
  workout: FeedWorkout
  /** The single set chosen to represent this workout. */
  highlightSet: FeedSet
  /** Final score after recency decay — used for sort order only. */
  score: number
  /** Rounded percentage of 1RM for the highlight set, or null if no 1RM on file. */
  pctOneRepMax: number | null
  /**
   * Extensible badge list rendered on the card.
   * Populated by the algorithm for standard signals; callers can append
   * additional labels (e.g. 'King Of Lift', 'Location PR') after calling
   * buildFeed().
   */
  extraBadges: string[]
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

    for (const set of workout.sets) {
      const { rawScore, pct } = scoreSet(set, liftsMap)
      const final = rawScore * decay
      if (final > bestFinal) {
        bestFinal = final
        highlightSet = set
        highlightPct = pct
      }
    }

    if (!highlightSet) continue

    const extraBadges: string[] = []
    // Future: push 'King Of Lift', 'Location PR', '🔥 Streak' etc. here

    items.push({
      workout,
      highlightSet,
      score: bestFinal,
      pctOneRepMax: highlightPct != null ? Math.round(highlightPct * 100) : null,
      extraBadges,
    })
  }

  // Rank highest score first.
  items.sort((a, b) => b.score - a.score)

  return items
}

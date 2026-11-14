import { createServerSupabase } from '@/lib/supabase-server'
import WorkoutTypePills from '@/components/WorkoutTypePills'
import { getAuthUser } from '@/lib/auth-user'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import DeleteWorkoutButton from './DeleteWorkoutButton'
import SummarySetsSection, { type SummarySet } from './SummarySetsSection'
import { canonicalName, epley1RM } from '@/lib/lifts'
import { formatCardioDistance, formatCardioDuration } from '@/lib/feed'
import ShareButton from './ShareButton'
import SyncToStravaButton from './SyncToStravaButton'

export default async function WorkoutSummaryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: workoutId } = await params
  const supabase = await createServerSupabase()
  const user = await getAuthUser()

  if (!user?.id) {
    redirect('/login')
  }

  const { data: workout } = await supabase
    .from('workouts')
    .select('id, name, created_at, status, user_id, location, post_photos, workout_types')
    .eq('id', workoutId)
    .single()

  if (!workout) {
    redirect('/history')
  }

  const isOwner = workout.user_id === user.id

  const { data: sets } = await supabase
    .from('sets')
    .select('id, exercise_id, exercise_name, weight, reps, rpe, video_url, created_at, distance_m, duration_seconds')
    .eq('workout_id', workoutId)
    .order('created_at', { ascending: true })

  // Group by exercise
  const grouped = (sets ?? []).reduce((acc: Record<string, SummarySet[]>, set) => {
    if (!acc[set.exercise_name]) acc[set.exercise_name] = []
    acc[set.exercise_name].push(set as SummarySet)
    return acc
  }, {})

  // Fetch current profile PRs + Strava connection status
  const { data: profile } = await supabase
    .from('profiles')
    .select('squat_1rm, bench_1rm, deadlift_1rm, strava_athlete_id')
    .eq('id', user.id)
    .single()

  const isStravaConnected = !!profile?.strava_athlete_id

  // Compute maxes for PR exercises — match by canonical name so all squat
  // variants ('Squat', 'Back Squat', 'Squat (Barbell)', etc.) are caught.
  // prBadges is keyed by raw exercise_name so SummarySetsSection can look up directly.
  const CANONICAL_PR_MAP: Record<string, string> = {
    'Back Squat': 'squat_1rm',
    'Bench Press': 'bench_1rm',
    'Deadlift': 'deadlift_1rm',
  }
  const prBadges: Record<string, boolean> = {}
  for (const [rawName, exerciseSets] of Object.entries(grouped)) {
    const cn = canonicalName(rawName)
    const prKey = CANONICAL_PR_MAP[cn]
    if (!prKey) continue
    const max = Math.max(...exerciseSets.map((s: any) => s.weight), 0)
    if (profile && max > ((profile as any)[prKey] ?? 0)) {
      prBadges[rawName] = true
    }
  }

  const allSets = (sets ?? []) as SummarySet[]
  const strengthSets = allSets.filter(s => !((s.distance_m ?? 0) > 0 || ((s.duration_seconds ?? 0) > 0 && s.weight === 0 && s.reps === 0)))
  const cardioSets = allSets.filter(s => (s.distance_m ?? 0) > 0 || ((s.duration_seconds ?? 0) > 0 && s.weight === 0 && s.reps === 0))
  const totalDistanceM = cardioSets.reduce((acc: number, s) => acc + (s.distance_m ?? 0), 0)
  const totalCardioSeconds = cardioSets.reduce((acc: number, s) => acc + (s.duration_seconds ?? 0), 0)
  const exerciseCount = Object.keys(grouped).length

  // How long it took: from starting the workout to the last set. Only trusted for workouts logged live (imported
  // workouts have every set saved at once, which would give nonsense), so anything over six hours is ignored.
  const lastSetAt = Math.max(0, ...allSets.map((s) => new Date(s.created_at).getTime()))
  const minutes = Math.round((lastSetAt - new Date(workout.created_at).getTime()) / 60000)
  const duration = minutes >= 5 && minutes <= 360 ? (minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes}m`) : null

  // PRs this session: for each exercise, the best estimated 1RM here against everything the athlete did earlier.
  // The earlier heaviest sets are enough to find the earlier best; an exercise with no earlier sets is not a PR.
  type SetWithId = SummarySet & { exercise_id?: string | null }
  const prs: { name: string; weight: number; reps: number; e1rm: number; previous: number }[] = []
  {
    const byExercise = new Map<string, { name: string; exerciseId: string | null; best: { weight: number; reps: number; e1rm: number } }>()
    for (const set of strengthSets as SetWithId[]) {
      const e1rm = epley1RM(set.weight, set.reps)
      if (e1rm === null || set.weight <= 0) continue
      const key = set.exercise_id ?? set.exercise_name
      const current = byExercise.get(key)
      if (!current || e1rm > current.best.e1rm) byExercise.set(key, { name: set.exercise_name, exerciseId: set.exercise_id ?? null, best: { weight: set.weight, reps: set.reps, e1rm } })
    }
    await Promise.all(
      [...byExercise.values()].map(async ({ name, exerciseId, best }) => {
        let query = supabase
          .from('sets')
          .select('weight, reps, workout:workouts!inner(created_at, status)')
          .eq('user_id', workout.user_id)
          .eq('workout.status', 'completed')
          .lt('workout.created_at', workout.created_at)
          .gt('weight', 0)
          .order('weight', { ascending: false })
          .limit(60)
        query = exerciseId ? query.eq('exercise_id', exerciseId) : query.eq('exercise_name', name)
        const { data: earlier } = await query
        if (!earlier || earlier.length === 0) return
        const previous = Math.max(0, ...earlier.map((e: { weight: number; reps: number }) => epley1RM(e.weight, e.reps) ?? 0))
        if (best.e1rm > previous) prs.push({ name, weight: best.weight, reps: best.reps, e1rm: best.e1rm, previous })
      }),
    )
    prs.sort((a, b) => b.e1rm - b.previous - (a.e1rm - a.previous))
  }

  return (
    <div className="mx-auto max-w-lg px-5 py-8">
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold mb-1">{workout.name?.trim() || 'Workout Summary'}</h1>
          <p className="text-sm text-zinc-400">{new Date(workout.created_at).toLocaleString()}</p>
          <WorkoutTypePills types={(workout as any).workout_types} className="mt-2" />
          {(workout as any).location && (
            <p className="mt-1.5 flex items-center gap-1.5 text-sm text-zinc-300">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 shrink-0 text-zinc-400" aria-hidden="true">
                <path fillRule="evenodd" d="M9.69 18.933l.003.001C9.89 19.02 10 19 10 19s.11.02.308-.066l.002-.001.006-.003.018-.008a5.741 5.741 0 00.281-.145 13.39 13.39 0 002.206-1.72C14.047 15.497 16 12.51 16 9.5a6 6 0 00-12 0c0 3.01 1.953 5.998 3.168 7.307a13.39 13.39 0 002.523 1.865zm-.004-12.183a2.25 2.25 0 113.182 3.182 2.25 2.25 0 01-3.182-3.182z" clipRule="evenodd" />
              </svg>
              {(workout as any).location}
            </p>
          )}
        </div>
        {isOwner && (
          <Link
            href={`/workout/${workout.id}`}
            aria-label="Edit workout"
            title="Edit workout"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              className="h-5 w-5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.862 3.487a2.1 2.1 0 112.97 2.97L9.26 17.03a3 3 0 01-1.265.75l-3.19.91.91-3.19a3 3 0 01.75-1.266L16.862 3.487z"
              />
            </svg>
          </Link>
        )}
      </div>

      <div className="mb-6 flex items-center justify-around divide-x divide-zinc-100 rounded-2xl border border-zinc-100 bg-white py-3 text-center shadow-sm">
        {duration && (
          <div className="flex-1 px-2">
            <p className="text-lg font-bold tabular-nums text-zinc-900">{duration}</p>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Time</p>
          </div>
        )}
        <div className="flex-1 px-2">
          <p className="text-lg font-bold tabular-nums text-zinc-900">{exerciseCount}</p>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">{exerciseCount === 1 ? 'Exercise' : 'Exercises'}</p>
        </div>
        <div className="flex-1 px-2">
          <p className="text-lg font-bold tabular-nums text-zinc-900">{allSets.length}</p>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">{allSets.length === 1 ? 'Set' : 'Sets'}</p>
        </div>
        {totalDistanceM > 0 && (
          <div className="flex-1 px-2">
            <p className="text-lg font-bold tabular-nums text-zinc-900">{formatCardioDistance(totalDistanceM)}</p>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">{totalCardioSeconds > 0 ? formatCardioDuration(totalCardioSeconds) : 'Distance'}</p>
          </div>
        )}
      </div>

      {prs.length > 0 && (
        <div className="mb-6 rounded-2xl border border-green-700/30 bg-green-50 p-4">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-green-700">{prs.length === 1 ? 'New PR' : `${prs.length} new PRs`}</p>
          <ul className="space-y-1.5">
            {prs.map((pr) => (
              <li key={pr.name} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 truncate font-semibold text-zinc-900">{pr.name}</span>
                <span className="shrink-0 text-xs text-zinc-600">
                  <span className="font-bold text-zinc-900">{pr.weight} × {pr.reps}</span> · est. 1RM {pr.e1rm} <span className="text-green-700">(+{pr.e1rm - pr.previous})</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {(() => {
        const photos: string[] = (workout as any).post_photos ?? []
        if (!photos.length) return null
        return (
          <div className="mb-6">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">Photos</h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {photos.map((src, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={i}
                  src={src}
                  alt={`Workout photo ${i + 1}`}
                  className="aspect-square w-full rounded-xl object-cover"
                />
              ))}
            </div>
          </div>
        )
      })()}

      <SummarySetsSection grouped={grouped} prBadges={prBadges} ownerId={isOwner ? null : workout.user_id} />
      <div className="mt-8 flex flex-col gap-3">
        <ShareButton workoutId={workout.id} />
        {isOwner && isStravaConnected && (
          <SyncToStravaButton workoutId={workout.id} />
        )}
      </div>

      {isOwner && (
        <div className="mt-4">
          <DeleteWorkoutButton workoutId={workout.id} />
        </div>
      )}
    </div>
  )
}

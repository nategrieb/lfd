import { createServerSupabase } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import DeleteWorkoutButton from './DeleteWorkoutButton'
import SummarySetsSection, { type SummarySet } from './SummarySetsSection'
import { canonicalName } from '@/lib/lifts'

export default async function WorkoutSummaryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: workoutId } = await params
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.id) {
    redirect('/login')
  }

  const { data: workout } = await supabase
    .from('workouts')
    .select('id, name, created_at, status')
    .eq('id', workoutId)
    .eq('user_id', user.id)
    .single()

  if (!workout) {
    redirect('/history')
  }

  const { data: sets } = await supabase
    .from('sets')
    .select('id, exercise_name, weight, reps, rpe, video_url, created_at')
    .eq('workout_id', workoutId)
    .order('created_at', { ascending: true })

  // Group by exercise
  const grouped = (sets ?? []).reduce((acc: Record<string, SummarySet[]>, set) => {
    if (!acc[set.exercise_name]) acc[set.exercise_name] = []
    acc[set.exercise_name].push(set as SummarySet)
    return acc
  }, {})

  // Fetch current profile PRs
  const { data: profile } = await supabase
    .from('profiles')
    .select('squat_1rm, bench_1rm, deadlift_1rm')
    .eq('id', user.id)
    .single()

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

  const totalVolume = (sets ?? []).reduce((acc: number, s: { weight: number; reps: number }) => acc + s.weight * s.reps, 0)

  return (
    <div className="mx-auto max-w-lg px-5 py-8">
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold mb-1">{workout.name?.trim() || 'Workout Summary'}</h1>
          <p className="text-sm text-zinc-400">{new Date(workout.created_at).toLocaleString()}</p>
        </div>
        <Link
          href={`/workout/${workout.id}`}
          aria-label="Edit workout"
          title="Edit workout"
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-700 text-zinc-200 hover:bg-zinc-800"
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
      </div>

      {totalVolume > 0 && (
        <div className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 text-center">
          <p className="text-3xl font-bold">{new Intl.NumberFormat('en-US').format(totalVolume)} lbs</p>
          <p className="text-xs text-zinc-400">Total volume</p>
        </div>
      )}

      <SummarySetsSection grouped={grouped} prBadges={prBadges} />

      <div className="mt-8 flex gap-3">
        <Link
          href="/history"
          className="flex-1 rounded-xl border border-zinc-700 py-3 text-center text-sm font-semibold text-zinc-200 transition active:bg-zinc-800"
        >
          History
        </Link>
        <Link
          href="/workout"
          className="flex-1 rounded-xl bg-amber-500 py-3 text-center text-sm font-semibold text-black transition hover:bg-amber-400"
        >
          New Workout
        </Link>
      </div>

      <div className="mt-4">
        <DeleteWorkoutButton workoutId={workout.id} />
      </div>
    </div>
  )
}

import { createServerSupabase } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import DeleteWorkoutButton from './DeleteWorkoutButton'
import SummarySetsSection, { type SummarySet } from './SummarySetsSection'
import { canonicalName } from '@/lib/lifts'
import ShareButton from './ShareButton'

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
    .select('id, name, created_at, status, user_id, location, post_photos')
    .eq('id', workoutId)
    .single()

  if (!workout) {
    redirect('/history')
  }

  const isOwner = workout.user_id === user.id

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

      {totalVolume > 0 && (
          <div className="mb-6 rounded-2xl border border-zinc-100 bg-white p-4 text-center shadow-sm">
          <p className="text-3xl font-bold text-zinc-900">{new Intl.NumberFormat('en-US').format(totalVolume)} lbs</p>
          <p className="text-xs text-zinc-400">Total volume</p>
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

      <SummarySetsSection grouped={grouped} prBadges={prBadges} />
      <div className="mt-8 flex flex-col gap-3">
        <ShareButton workoutId={workout.id} />
        <div className="flex gap-3">
          <Link
            href={isOwner ? '/history' : '/'}
            className="flex-1 rounded-xl border border-zinc-200 py-3 text-center text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
          >
            {isOwner ? 'History' : 'Feed'}
          </Link>
          {isOwner && (
            <Link
              href="/workout"
              className="flex-1 rounded-xl py-3 text-center text-sm font-semibold text-white transition hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #166534, #16a34a)' }}
            >
              New Workout
            </Link>
          )}
        </div>
      </div>

      {isOwner && (
        <div className="mt-4">
          <DeleteWorkoutButton workoutId={workout.id} />
        </div>
      )}
    </div>
  )
}

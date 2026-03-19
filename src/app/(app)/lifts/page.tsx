import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase-server'
import { canonicalName, nameToSlug, epley1RM } from '@/lib/lifts'

export default async function LiftsIndexPage() {
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.id) redirect('/login')

  // Fetch all sets with workout dates for grouping
  const { data: rawSets } = await supabase
    .from('sets')
    .select('exercise_name, weight, reps, video_url, workout_id, workout:workouts(created_at)')
    .eq('user_id', user.id)

  type ExerciseSummary = {
    canonical: string
    slug: string
    sessionIds: Set<string>
    lastDate: string
    bestWeight: number
    bestE1RM: number
    hasVideo: boolean
  }

  const exerciseMap = new Map<string, ExerciseSummary>()

  for (const raw of (rawSets ?? []) as any[]) {
    const canonical = canonicalName(raw.exercise_name ?? '')
    if (!canonical) continue

    if (!exerciseMap.has(canonical)) {
      exerciseMap.set(canonical, {
        canonical,
        slug: nameToSlug(raw.exercise_name ?? ''),
        sessionIds: new Set(),
        lastDate: '',
        bestWeight: 0,
        bestE1RM: 0,
        hasVideo: false,
      })
    }

    const entry = exerciseMap.get(canonical)!
    const workoutDate = raw.workout?.created_at ?? ''

    if (raw.workout_id) entry.sessionIds.add(raw.workout_id)
    if (workoutDate > entry.lastDate) entry.lastDate = workoutDate
    if ((raw.weight ?? 0) > entry.bestWeight) entry.bestWeight = raw.weight ?? 0
    if (raw.video_url) entry.hasVideo = true

    const e1rm = epley1RM(raw.weight ?? 0, raw.reps ?? 0)
    if (e1rm && e1rm > entry.bestE1RM) entry.bestE1RM = e1rm
  }

  const exercises = [...exerciseMap.values()]
    .sort((a, b) => b.lastDate.localeCompare(a.lastDate))

  return (
    <div className="mx-auto max-w-lg px-5 py-8">
      <header className="mb-6 flex items-center gap-4">
        <Link
          href="/history"
          aria-label="Back"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-zinc-200 text-zinc-400 transition-colors hover:border-zinc-300 hover:text-zinc-700"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
            <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Lifts</h1>
          <p className="mt-0.5 text-sm text-zinc-400">
            {exercises.length} exercise{exercises.length !== 1 ? 's' : ''} tracked
          </p>
        </div>
      </header>

      {exercises.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-200 px-6 py-12 text-center">
          <p className="text-sm font-medium text-zinc-400">No lifts recorded yet.</p>
          <p className="mt-1 text-xs text-zinc-600">
            Complete a workout to see your lift history here.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {exercises.map(({ canonical, slug, sessionIds, lastDate, bestWeight, bestE1RM, hasVideo }) => {
            const sessionCount = sessionIds.size
            const dateLabel = lastDate
              ? new Date(lastDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
              : ''

            return (
              <li key={canonical}>
                <Link
                  href={`/lifts/${slug}`}
                  className="flex items-center gap-3 rounded-xl border border-zinc-100 bg-white shadow-sm px-4 py-3.5 transition hover:bg-zinc-50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate font-semibold">{canonical}</p>
                      {hasVideo && (
                        <span
                          className="h-1.5 w-1.5 shrink-0 rounded-full bg-green-600"
                          title="Has video"
                          aria-label="Has video"
                        />
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      {sessionCount} session{sessionCount !== 1 ? 's' : ''}
                      {bestE1RM > 0 && ` · Est. 1RM: ${bestE1RM} lbs`}
                      {dateLabel && ` · Last: ${dateLabel}`}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    {bestWeight > 0 && (
                      <p className="text-sm font-bold">{bestWeight} lbs</p>
                    )}
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      className="ml-auto mt-0.5 h-4 w-4 text-zinc-600"
                      aria-hidden="true"
                    >
                      <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                    </svg>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase-server'
import { canonicalName, slugToCanonical, epley1RM } from '@/lib/lifts'
import LiftChart, { type ChartPoint } from './LiftChart'
import LiftVideoSection, { type VideoClip } from './LiftVideoSection'

type LiftSet = {
  id: string
  exercise_name: string
  weight: number
  reps: number
  rpe: number | null
  video_url: string | null
  workout_id: string
  workout: { id: string; name: string | null; created_at: string } | null
}

type Session = {
  workoutId: string
  workoutName: string | null
  workoutDate: string
  sets: LiftSet[]
  bestSet: LiftSet
  bestE1RM: number | null
}

export default async function LiftDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.id) redirect('/login')

  // Step 1: Discover all exercise name variants the user has logged
  const { data: nameRows } = await supabase
    .from('sets')
    .select('exercise_name')
    .eq('user_id', user.id)

  const allNames = [...new Set((nameRows ?? []).map((r: any) => r.exercise_name as string))]
  const targetCanonical = slugToCanonical(slug)

  // Step 2: Filter to names that normalise to the same canonical
  const matchingNames = allNames.filter(n => canonicalName(n) === targetCanonical)
  if (matchingNames.length === 0) redirect('/lifts')

  // Step 3: Fetch all sets for this exercise (all variants) with workout info
  const { data: rawSets } = await supabase
    .from('sets')
    .select('id, exercise_name, weight, reps, rpe, video_url, workout_id, workout:workouts(id, name, created_at)')
    .eq('user_id', user.id)
    .in('exercise_name', matchingNames)
    .order('created_at', { ascending: true })

  const sets = (rawSets ?? []) as unknown as LiftSet[]
  if (sets.length === 0) redirect('/lifts')

  // Group by workout session
  const sessionMap = new Map<string, Session>()
  for (const set of sets) {
    const wid = set.workout_id
    const date = set.workout?.created_at ?? ''
    if (!sessionMap.has(wid)) {
      sessionMap.set(wid, {
        workoutId: wid,
        workoutName: set.workout?.name ?? null,
        workoutDate: date,
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

  // Sessions newest → oldest for the history list
  const sessions = [...sessionMap.values()].sort(
    (a, b) => b.workoutDate.localeCompare(a.workoutDate),
  )

  // Chart data oldest → newest for the progress line
  const chartData: ChartPoint[] = [...sessionMap.values()]
    .sort((a, b) => a.workoutDate.localeCompare(b.workoutDate))
    .map(s => ({
      date: s.workoutDate,
      e1rm: s.bestE1RM ?? s.bestSet.weight,
      weight: s.bestSet.weight,
      reps: s.bestSet.reps,
    }))

  // All-time PR stats
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

  // Collect video clips across all sessions (newest first)
  const videoClips: VideoClip[] = sessions.flatMap(s =>
    s.sets
      .filter(set => set.video_url)
      .map(set => ({
        src: set.video_url!,
        title: `${set.weight} lbs × ${set.reps}`,
        date: new Date(s.workoutDate).toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        }),
      })),
  )

  return (
    <div className="mx-auto max-w-lg px-5 py-8">
      {/* Header */}
      <header className="mb-6 flex items-start gap-4">
        <Link
          href="/lifts"
          aria-label="Back to all lifts"
          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-zinc-700 text-zinc-400 transition-colors hover:border-zinc-500 hover:text-zinc-200"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
            <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">{targetCanonical}</h1>
          <p className="mt-0.5 text-sm text-zinc-400">
            {sessions.length} session{sessions.length !== 1 ? 's' : ''}
          </p>
        </div>
      </header>

      {/* PR stats */}
      <section className="mb-6 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-amber-500">
            Best Set
          </p>
          <p className="text-2xl font-bold">{prWeight} lbs</p>
          <p className="text-xs text-zinc-400">
            {prReps} rep{prReps !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Est. 1RM
          </p>
          <p className="text-2xl font-bold">{prE1RM > 0 ? `${prE1RM} lbs` : '—'}</p>
          <p className="text-xs text-zinc-400">Epley formula</p>
        </div>
      </section>

      {/* Progress chart */}
      {chartData.length >= 2 && (
        <section className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Est. 1RM Progress · {chartData.length} sessions
          </p>
          <LiftChart data={chartData} />
          <div className="mt-2 flex justify-between text-[10px] text-zinc-600">
            <span>
              {new Date(chartData[0].date).toLocaleDateString(undefined, {
                month: 'short',
                year: '2-digit',
              })}
            </span>
            <span>
              {new Date(chartData[chartData.length - 1].date).toLocaleDateString(undefined, {
                month: 'short',
                year: '2-digit',
              })}
            </span>
          </div>
        </section>
      )}

      {/* Videos */}
      <LiftVideoSection clips={videoClips} />

      {/* Session history */}
      <section>
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Session History
        </h2>

        <div className="space-y-3">
          {sessions.map(session => (
            <div
              key={session.workoutId}
              className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/40"
            >
              {/* Session header — taps to full summary */}
              <Link
                href={`/workout/${session.workoutId}/summary`}
                className="flex items-center justify-between px-4 py-3 transition-colors hover:bg-zinc-800/40"
              >
                <div>
                  <p className="text-sm font-semibold">
                    {new Date(session.workoutDate).toLocaleDateString(undefined, {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </p>
                  {session.workoutName && (
                    <p className="text-xs text-zinc-500">{session.workoutName}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {session.bestE1RM !== null && (
                    <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-bold text-amber-300">
                      e1RM {session.bestE1RM}
                    </span>
                  )}
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="h-4 w-4 text-zinc-600"
                    aria-hidden="true"
                  >
                    <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                  </svg>
                </div>
              </Link>

              {/* Sets list */}
              <div className="border-t border-zinc-800 px-4 pb-3 pt-2">
                <ul className="space-y-1">
                  {session.sets.map((set, i) => {
                    const isBest = set === session.bestSet
                    const e1rm = epley1RM(set.weight, set.reps)
                    return (
                      <li
                        key={set.id}
                        className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 text-sm ${
                          isBest ? 'bg-amber-500/10' : ''
                        }`}
                      >
                        <span className={`text-xs ${isBest ? 'text-amber-400' : 'text-zinc-500'}`}>
                          Set {i + 1}
                        </span>
                        <span className={`font-medium ${isBest ? 'text-white' : ''}`}>
                          {set.weight} lbs × {set.reps}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {set.rpe !== null && (
                            <span className="rounded bg-zinc-700/80 px-1.5 py-0.5 text-xs text-zinc-300">
                              RPE {set.rpe}
                            </span>
                          )}
                          {e1rm !== null && isBest && (
                            <span className="text-xs text-zinc-500">e1RM {e1rm}</span>
                          )}
                          {set.video_url && (
                            <span
                              className="h-1.5 w-1.5 rounded-full bg-amber-500"
                              title="Has video"
                            />
                          )}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

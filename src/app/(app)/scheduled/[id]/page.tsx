import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase-server'
import { formatTempo, formatRest } from '@/lib/programs'
import StartButton from './StartButton'

export const dynamic = 'force-dynamic'

const STATUS_LABEL: Record<string, string> = {
  planned:   'Scheduled',
  started:   'In Progress',
  completed: 'Completed',
  skipped:   'Skipped',
}

const STATUS_STYLE: Record<string, string> = {
  planned:   'bg-zinc-800 text-zinc-400',
  started:   'bg-amber-900/40 text-amber-400',
  completed: 'bg-emerald-900/40 text-emerald-400',
  skipped:   'bg-rose-900/30 text-rose-400',
}

export default async function ScheduledWorkoutPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: scheduledId } = await params

  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.id) redirect('/login')

  const { data: sw } = await supabase
    .from('scheduled_workouts')
    .select('id, scheduled_date, status, workout_id, template_workouts(name, week_number, day_number)')
    .eq('id', scheduledId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!sw) redirect('/history')

  // If already in progress or completed, redirect to the actual workout
  if (sw.status === 'started' && sw.workout_id) redirect(`/workout/${sw.workout_id}`)
  if (sw.status === 'completed' && sw.workout_id) redirect(`/workout/${sw.workout_id}/summary`)

  const { data: scheduledSets } = await supabase
    .from('scheduled_sets')
    .select(
      'id, sort_order, exercise_name, sets_count, reps, reps_note, calculated_weight, percentage, target_rpe, tempo, rest_seconds',
    )
    .eq('scheduled_workout_id', scheduledId)
    .order('sort_order', { ascending: true })

  const tw = sw.template_workouts as any
  const scheduledDate = new Date(sw.scheduled_date + 'T00:00:00')
  const todayISO = new Date().toISOString().slice(0, 10)
  const canStart = sw.scheduled_date <= todayISO && sw.status !== 'completed' && sw.status !== 'skipped'

  const dateLabel = scheduledDate.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  const status = sw.status ?? 'planned'

  return (
    <div className="mx-auto max-w-lg px-5 py-8">
      {/* Header */}
      <header className="mb-6 flex items-start gap-4">
        <Link
          href="/history"
          aria-label="Back"
          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-zinc-700 text-zinc-400 transition-colors hover:border-zinc-500 hover:text-zinc-200"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
            <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
          </svg>
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-extrabold tracking-tight">
              {tw?.name ?? 'Program Workout'}
            </h1>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLE[status] ?? STATUS_STYLE.planned}`}>
              {STATUS_LABEL[status] ?? status}
            </span>
          </div>
          <p className="mt-1 text-sm text-zinc-400">{dateLabel}</p>
          {tw?.week_number && (
            <p className="mt-0.5 text-xs text-zinc-600">
              Week {tw.week_number} · Day {tw.day_number}
            </p>
          )}
        </div>
      </header>

      {/* Set groups */}
      <section className="mb-6 space-y-2">
        {(scheduledSets ?? []).map((s) => {
          const repsLabel = s.reps
            ? `${s.sets_count}×${s.reps}${s.reps_note ? ` (${s.reps_note})` : ''}`
            : `${s.sets_count}×${s.reps_note ?? '–'}`

          const intensityBadge = s.calculated_weight
            ? `${s.calculated_weight} lbs`
            : s.target_rpe
            ? `RPE ${s.target_rpe}`
            : s.percentage
            ? `${Math.round(s.percentage * 100)}%`
            : null

          return (
            <div
              key={s.id}
              className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-zinc-100">{s.exercise_name}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                  <span>{repsLabel}</span>
                  {s.tempo && <span>{formatTempo(s.tempo)}</span>}
                  {s.rest_seconds && <span>{formatRest(s.rest_seconds)}</span>}
                </div>
              </div>
              {intensityBadge && (
                <span
                  className={[
                    'ml-3 shrink-0 rounded-lg px-2.5 py-1 text-xs font-bold',
                    s.calculated_weight
                      ? 'bg-amber-500/10 text-amber-400'
                      : 'bg-zinc-800 text-zinc-400',
                  ].join(' ')}
                >
                  {intensityBadge}
                </span>
              )}
            </div>
          )
        })}
      </section>

      {/* Start button */}
      {canStart && <StartButton scheduledId={scheduledId} />}

      {!canStart && sw.status === 'planned' && (
        <p className="text-center text-sm text-zinc-600">
          This workout is scheduled for {dateLabel}.
        </p>
      )}
    </div>
  )
}

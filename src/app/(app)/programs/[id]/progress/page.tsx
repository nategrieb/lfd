import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase-server'

const STATUS_STYLES: Record<string, string> = {
  planned:    'border-zinc-700 bg-zinc-900/60 text-zinc-400',
  started:    'border-amber-600/50 bg-amber-900/20 text-amber-300',
  completed:  'border-emerald-700/50 bg-emerald-900/20 text-emerald-300',
  skipped:    'border-rose-700/40 bg-rose-900/10 text-rose-400 line-through',
}

const STATUS_DOT: Record<string, string> = {
  planned:   'bg-zinc-600',
  started:   'bg-amber-500',
  completed: 'bg-emerald-500',
  skipped:   'bg-rose-500',
}

export default async function ProgramProgressPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: templateId } = await params

  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.id) redirect('/login')

  const { data: tmpl } = await supabase
    .from('program_templates')
    .select('id, name, duration_weeks')
    .eq('id', templateId)
    .single()

  if (!tmpl) redirect('/programs')

  const { data: enrollment } = await supabase
    .from('program_enrollments')
    .select('id, start_date, end_date, squat_max, bench_max, deadlift_max, status')
    .eq('user_id', user.id)
    .eq('template_id', templateId)
    .eq('status', 'active')
    .maybeSingle()

  if (!enrollment) redirect(`/programs/${templateId}`)

  // Fetch all scheduled workouts + their template workout names/week/day
  const { data: rawScheduled } = await supabase
    .from('scheduled_workouts')
    .select(`
      id, scheduled_date, status, workout_id,
      template_workouts ( week_number, day_number, name )
    `)
    .eq('user_id', user.id)
    .eq('enrollment_id', enrollment.id)
    .order('scheduled_date', { ascending: true })

  // Group by week number
  const weekMap = new Map<number, typeof rawScheduled>()
  for (const sw of rawScheduled ?? []) {
    const tw = sw.template_workouts as any
    const wn: number = tw?.week_number ?? 0
    if (!weekMap.has(wn)) weekMap.set(wn, [])
    weekMap.get(wn)!.push(sw)
  }
  const weeks = [...weekMap.entries()].sort((a, b) => a[0] - b[0])

  // Summary counts
  const all = rawScheduled ?? []
  const completedCount = all.filter(s => s.status === 'completed').length
  const totalCount = all.length

  return (
    <div className="mx-auto max-w-lg px-5 py-8">
      <header className="mb-6 flex items-center gap-4">
        <Link
          href={`/programs/${templateId}`}
          aria-label="Back"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-zinc-700 text-zinc-400 transition-colors hover:border-zinc-500 hover:text-zinc-200"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
            <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
          </svg>
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-extrabold tracking-tight">{tmpl.name}</h1>
          <p className="mt-0.5 text-sm text-zinc-400">Program Progress</p>
        </div>
      </header>

      {/* Progress bar */}
      <div className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 px-5 py-4">
        <div className="flex items-center justify-between text-xs text-zinc-400">
          <span>{completedCount} of {totalCount} workouts done</span>
          <span>{totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0}%</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-800">
          <div
            className="h-full rounded-full bg-amber-500 transition-all"
            style={{ width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%` }}
          />
        </div>
        <p className="mt-2.5 text-xs text-zinc-500">
          Maxes used: Squat {enrollment.squat_max} · Bench {enrollment.bench_max} · Deadlift {enrollment.deadlift_max}
        </p>
      </div>

      {/* Legend */}
      <div className="mb-4 flex flex-wrap gap-3">
        {Object.entries(STATUS_DOT).map(([status, dotClass]) => (
          <div key={status} className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${dotClass}`} />
            <span className="text-xs capitalize text-zinc-500">{status}</span>
          </div>
        ))}
      </div>

      {/* Week-by-week grid */}
      <div className="space-y-6">
        {weeks.map(([weekNum, days]) => (
          <section key={weekNum}>
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-zinc-500">
              {weekNum === 9 ? 'Week 9 – Taper' : `Week ${weekNum}`}
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(days ?? [])
                .sort((a, b) => {
                  const aDn = (a.template_workouts as any)?.day_number ?? 0
                  const bDn = (b.template_workouts as any)?.day_number ?? 0
                  return aDn - bDn
                })
                .map((sw) => {
                  const tw = sw.template_workouts as any
                  const status = sw.status ?? 'planned'
                  const styleClass = STATUS_STYLES[status] ?? STATUS_STYLES.planned
                  const dotClass  = STATUS_DOT[status] ?? STATUS_DOT.planned

                  const linkHref =
                    sw.workout_id
                      ? status === 'completed'
                        ? `/workout/${sw.workout_id}/summary`
                        : `/workout/${sw.workout_id}`
                      : status === 'planned' || status === 'started'
                      ? `/scheduled/${sw.id}`
                      : null

                  const cardContent = (
                    <div className={`rounded-xl border px-3 py-3 text-xs transition ${styleClass} ${linkHref ? 'cursor-pointer hover:opacity-80' : ''}`}>
                      <div className="flex items-start justify-between gap-1">
                        <span className="font-semibold leading-tight">
                          D{tw?.day_number ?? '?'}
                        </span>
                        <span className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${dotClass}`} />
                      </div>
                      <p className="mt-1 line-clamp-2 leading-tight text-zinc-300 opacity-80">
                        {tw?.name ?? '–'}
                      </p>
                      <p className="mt-1 text-zinc-600">
                        {new Date(sw.scheduled_date + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </p>
                    </div>
                  )

                  return linkHref ? (
                    <Link key={sw.id} href={linkHref}>
                      {cardContent}
                    </Link>
                  ) : (
                    <div key={sw.id}>
                      {cardContent}
                    </div>
                  )
                })}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}

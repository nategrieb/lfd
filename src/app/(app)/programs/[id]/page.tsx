import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase-server'
import EnrollForm from '../EnrollForm'
import UnenrollButton from '../UnenrollButton'

export default async function ProgramDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ enrolled?: string }>
}) {
  const { id: templateId } = await params
  const { enrolled } = await searchParams

  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.id) redirect('/login')

  const [{ data: tmpl }, { data: profile }, { data: enrollment }] = await Promise.all([
    supabase
      .from('program_templates')
      .select('id, name, description, duration_weeks')
      .eq('id', templateId)
      .single(),
    supabase
      .from('profiles')
      .select('squat_1rm, bench_1rm, deadlift_1rm')
      .eq('id', user.id)
      .single(),
    supabase
      .from('program_enrollments')
      .select('id, start_date, end_date, status, squat_max, bench_max, deadlift_max')
      .eq('user_id', user.id)
      .eq('template_id', templateId)
      .eq('status', 'active')
      .maybeSingle(),
  ])

  if (!tmpl) redirect('/programs')

  // Fetch program structure: all template_workouts + template_sets
  const { data: rawWorkouts } = await supabase
    .from('template_workouts')
    .select(`
      id, week_number, day_number, name,
      template_sets (id, sort_order, exercise_name, sets_count, reps, reps_note, percentage, target_rpe, tempo, rest_seconds)
    `)
    .eq('template_id', templateId)
    .order('week_number')
    .order('day_number')

  // Group by week
  const weekMap = new Map<number, typeof rawWorkouts>()
  for (const tw of rawWorkouts ?? []) {
    if (!weekMap.has(tw.week_number)) weekMap.set(tw.week_number, [])
    weekMap.get(tw.week_number)!.push(tw)
  }
  const weeks = [...weekMap.entries()].sort((a, b) => a[0] - b[0])

  const squatMax  = profile?.squat_1rm ?? null
  const benchMax  = profile?.bench_1rm ?? null
  const dlMax     = profile?.deadlift_1rm ?? null

  return (
    <div className="mx-auto max-w-lg px-5 py-8">
      <header className="mb-6 flex items-center gap-4">
        <Link
          href="/programs"
          aria-label="Back"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-zinc-700 text-zinc-400 transition-colors hover:border-zinc-500 hover:text-zinc-200"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
            <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
          </svg>
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-extrabold tracking-tight">{tmpl.name}</h1>
          <p className="mt-0.5 text-sm text-zinc-400">{tmpl.duration_weeks} weeks</p>
        </div>
        {enrollment && (
          <Link
            href={`/programs/${templateId}/progress`}
            className="shrink-0 rounded-xl border border-amber-600/50 bg-amber-900/20 px-3 py-1.5 text-xs font-semibold text-amber-400 transition hover:bg-amber-900/40"
          >
            Progress →
          </Link>
        )}
      </header>

      {tmpl.description && (
        <p className="mb-6 text-sm text-zinc-400">{tmpl.description}</p>
      )}

      {enrolled === '1' && (
        <div className="mb-6 rounded-xl border border-emerald-700 bg-emerald-900/30 px-4 py-3 text-sm text-emerald-300">
          You&apos;re enrolled! Planned workouts have been added to your calendar.{' '}
          <Link href={`/programs/${templateId}/progress`} className="underline">View progress →</Link>
        </div>
      )}

      {/* Active enrollment status */}
      {enrollment ? (
        <div className="mb-6 rounded-2xl border border-amber-600/40 bg-amber-900/20 px-5 py-4">
          <p className="text-sm font-semibold text-amber-400">Currently enrolled</p>
          <p className="mt-1 text-xs text-zinc-400">
            {new Date(enrollment.start_date).toLocaleDateString()} –{' '}
            {enrollment.end_date ? new Date(enrollment.end_date).toLocaleDateString() : '–'}
          </p>
          <p className="mt-0.5 text-xs text-zinc-500">
            Maxes: Squat {enrollment.squat_max} · Bench {enrollment.bench_max} · Deadlift {enrollment.deadlift_max}
          </p>
          <UnenrollButton enrollmentId={enrollment.id} templateId={templateId} />
        </div>
      ) : (
        <section className="mb-8 rounded-2xl border border-zinc-700 bg-zinc-900/60 px-5 py-5">
          <h2 className="mb-4 text-base font-semibold">Enroll in this program</h2>
          <EnrollForm
            programId={tmpl.id}
            durationWeeks={tmpl.duration_weeks}
            squatMax={squatMax}
            benchMax={benchMax}
            deadliftMax={dlMax}
          />
        </section>
      )}

      {/* Program overview by week */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">Program Overview</h2>
        <div className="space-y-4">
          {weeks.map(([weekNum, days]) => (
            <div key={weekNum}>
              <p className="mb-2 text-sm font-bold">
                {weekNum === 9 ? 'Week 9 – Taper' : `Week ${weekNum}`}
              </p>
              <div className="space-y-2">
                {(days ?? []).map((tw) => (
                  <div key={tw.id} className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
                    <p className="text-xs font-semibold text-zinc-300">{tw.name}</p>
                    <ul className="mt-2 space-y-1">
                      {((tw.template_sets ?? []) as any[])
                        .sort((a, b) => a.sort_order - b.sort_order)
                        .map((ts: any) => (
                          <li key={ts.id} className="flex flex-wrap items-baseline gap-x-2 text-xs text-zinc-400">
                            <span className="font-medium text-zinc-200">{ts.exercise_name}</span>
                            <span>{ts.sets_count}×{ts.reps ?? ts.reps_note}</span>
                            {ts.percentage && (
                              <span className="text-amber-400">@{Math.round(ts.percentage * 100)}%</span>
                            )}
                            {ts.target_rpe && (
                              <span className="text-amber-400">RPE {ts.target_rpe}</span>
                            )}
                            {ts.tempo && <span className="text-zinc-600">{ts.tempo}</span>}
                          </li>
                        ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

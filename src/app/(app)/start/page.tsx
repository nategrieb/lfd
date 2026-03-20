import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase-server'
import StartFreeWorkoutButton from './StartFreeWorkoutButton'

export const dynamic = 'force-dynamic'

export default async function StartPage() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) redirect('/login')

  // If there's already an in-progress workout, go straight there
  const { data: active } = await supabase
    .from('workouts')
    .select('id')
    .eq('user_id', user.id)
    .eq('status', 'in_progress')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (active?.id) redirect(`/workout/${active.id}`)

  // Today's scheduled workout from an active program enrollment
  const todayISO = new Date().toISOString().slice(0, 10)
  const { data: todayScheduled } = await supabase
    .from('scheduled_workouts')
    .select('id, scheduled_date, template_workouts(name, week_number, day_number)')
    .eq('user_id', user.id)
    .eq('scheduled_date', todayISO)
    .in('status', ['planned', 'started'])
    .maybeSingle()

  // Next upcoming scheduled workout (if nothing today)
  const { data: nextScheduled } = !todayScheduled
    ? await supabase
        .from('scheduled_workouts')
        .select('id, scheduled_date, template_workouts(name, week_number, day_number)')
        .eq('user_id', user.id)
        .gt('scheduled_date', todayISO)
        .in('status', ['planned'])
        .order('scheduled_date', { ascending: true })
        .limit(1)
        .maybeSingle()
    : { data: null }

  const programWorkout = todayScheduled ?? nextScheduled
  const tw = programWorkout?.template_workouts as any
  const isToday = !!todayScheduled

  return (
    <div className="mx-auto max-w-lg px-4 pb-20 pt-10">
      <h1 className="mb-2 text-2xl font-extrabold tracking-tight text-zinc-900">Let's lift</h1>
      <p className="mb-8 text-sm text-zinc-400">Choose how you want to train today.</p>

      <div className="flex flex-col gap-3">

        {/* Program workout card */}
        {programWorkout && tw ? (
          <Link
            href={`/scheduled/${programWorkout.id}`}
            className="group relative overflow-hidden rounded-3xl px-6 py-6 shadow-sm transition hover:opacity-95"
            style={{ background: 'linear-gradient(135deg, #166534, #16a34a)' }}
          >
            <p className="text-[11px] font-semibold uppercase tracking-wider text-green-200">
              {isToday ? "Today's session" : `Scheduled · ${new Date(programWorkout.scheduled_date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}`}
            </p>
            <p className="mt-1 text-xl font-black text-white">{tw.name}</p>
            <p className="mt-0.5 text-sm text-green-200">
              Week {tw.week_number} · Day {tw.day_number}
            </p>
            <div className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-white/20 px-4 py-2 text-sm font-bold text-white backdrop-blur-sm">
              Start session
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" />
              </svg>
            </div>
          </Link>
        ) : (
          <div className="rounded-3xl border border-dashed border-zinc-200 bg-white px-6 py-6">
            <p className="text-sm font-semibold text-zinc-400">No program scheduled</p>
            <p className="mt-0.5 text-xs text-zinc-300">
              Enroll in a program to see your next session here.
            </p>
            <Link href="/search?tab=programs" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-green-700 hover:underline">
              Browse programs
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" />
              </svg>
            </Link>
          </div>
        )}

        {/* Free workout card */}
        <div className="rounded-3xl border border-zinc-100 bg-white px-6 py-6 shadow-sm">
          <p className="text-sm font-semibold text-zinc-800">Free workout</p>
          <p className="mt-0.5 text-xs text-zinc-400">No plan — log whatever you want.</p>
          <div className="mt-4">
            <StartFreeWorkoutButton />
          </div>
        </div>

      </div>
    </div>
  )
}

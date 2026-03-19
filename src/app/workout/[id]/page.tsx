import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase-server'
import WorkoutSession from './WorkoutSession'
import { finishWorkout } from '@/app/workout/actions'

export const dynamic = 'force-dynamic'

export default async function WorkoutPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: workoutId } = await params

  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.id) {
    return null
  }

  const userId = user.id

  const { data: workout } = await supabase
    .from('workouts')
    .select('id, status')
    .eq('id', workoutId)
    .eq('user_id', userId)
    .single()

  if (!workout) {
    redirect('/workout')
  }

  const { data: sets, error: setsError } = await supabase
    .from('sets')
    .select('id, exercise_name, weight, reps, created_at, video_url')
    .eq('workout_id', workoutId)
    .order('created_at', { ascending: true })

  if (setsError) {
    return (
      <main className="min-h-screen bg-zinc-950 text-white">
        <div className="mx-auto max-w-3xl px-6 py-20">
          <h1 className="text-3xl font-semibold">Workout</h1>
          <p className="mt-4 text-sm text-red-400">Error loading sets: {setsError.message}</p>
        </div>
      </main>
    )
  }

  type WorkoutSet = {
    id: string
    exercise_name: string
    weight: number
    reps: number
    created_at: string
    video_url: string | null
  }

  const setRows = (sets ?? []) as WorkoutSet[]

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-20">
        <header className="flex flex-col gap-2">
          <h1 className="text-4xl font-extrabold tracking-tight">Workout</h1>
          <p className="text-sm text-zinc-400">Log sets for your current session.</p>
        </header>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-8 shadow">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-xl font-semibold">Sets</h2>
            <a
              href="/profile"
              className="rounded-xl bg-zinc-800 px-4 py-2 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-700"
            >
              Profile
            </a>
          </div>

          <WorkoutSession workoutId={workoutId} initialSets={setRows} />
        </section>

      </div>
    </main>
  )
}

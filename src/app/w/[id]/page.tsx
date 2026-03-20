import { notFound } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import type { Metadata } from 'next'
import PublicWorkoutVideoReel from './PublicWorkoutVideoReel'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ id: string }> }

// Public anon client — no cookies needed, works for unauthenticated visitors.
function anonSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────

type SetRow = {
  id: string
  exercise_name: string
  weight: number
  reps: number
  rpe: number | null
  video_url: string | null
  thumbnail_url?: string | null
  created_at: string
}

/** Pick the "top" set: prefer one with a video, then highest weight×reps. */
function topSet(sets: SetRow[]): SetRow | null {
  if (!sets.length) return null
  const withVideo = sets.filter(s => s.video_url)
  const pool = withVideo.length ? withVideo : sets
  return pool.reduce((best, s) =>
    s.weight * s.reps > best.weight * best.reps ? s : best
  )
}

async function fetchWorkoutData(id: string) {
  const supabase = anonSupabase()

  const { data: workout } = await supabase
    .from('workouts')
    .select('id, name, created_at, user_id')
    .eq('id', id)
    .maybeSingle()

  if (!workout) return null

  const { data: sets } = await supabase
    .from('sets')
    .select('id, exercise_name, weight, reps, rpe, video_url, thumbnail_url, created_at')
    .eq('workout_id', id)
    .order('created_at', { ascending: true })

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, username')
    .eq('id', workout.user_id)
    .maybeSingle()

  return { workout, sets: (sets ?? []) as SetRow[], profile }
}

// ── OG metadata — drives the rich preview thumbnail ───────────────────────

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const data = await fetchWorkoutData(id)
  if (!data) return { title: 'Workout' }

  const { workout, sets, profile } = data
  const hero = topSet(sets)
  const displayName = profile?.display_name ?? profile?.username ?? 'Someone'

  const totalVolume = sets.reduce((acc, s) => acc + s.weight * s.reps, 0)
  const clips = sets.filter((s) => !!s.video_url).map((s) => ({
    id: s.id,
    exercise_name: s.exercise_name,
    weight: s.weight,
    reps: s.reps,
    rpe: s.rpe,
    video_url: s.video_url!,
  }))
  const volumeStr = totalVolume > 0
    ? `${new Intl.NumberFormat('en-US').format(totalVolume)} lbs total volume`
    : ''

  const title = `${displayName}'s workout — ${workout.name?.trim() || new Date(workout.created_at).toLocaleDateString()}`
  const description = [volumeStr, `${sets.length} sets across ${new Set(sets.map(s => s.exercise_name)).size} exercises`]
    .filter(Boolean).join(' · ')

  const pagePath = `/w/${id}`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: pagePath,
      type: 'website',
      images: [{ url: `${pagePath}/opengraph-image`, width: 1200, height: 630 }],
    },
  }
}

// ── Page ──────────────────────────────────────────────────────────────────

export default async function PublicWorkoutPage({ params }: Props) {
  const { id } = await params
  const data = await fetchWorkoutData(id)
  if (!data) notFound()

  const { workout, sets, profile } = data
  const hero = topSet(sets)
  const displayName = profile?.display_name ?? profile?.username ?? 'Someone'

  const totalVolume = sets.reduce((acc, s) => acc + s.weight * s.reps, 0)
  const clips = sets.filter((s) => !!s.video_url).map((s) => ({
    id: s.id,
    exercise_name: s.exercise_name,
    weight: s.weight,
    reps: s.reps,
    rpe: s.rpe,
    video_url: s.video_url!,
  }))

  // Group sets by exercise for the stats section
  const grouped = sets.reduce((acc: Record<string, SetRow[]>, s) => {
    if (!acc[s.exercise_name]) acc[s.exercise_name] = []
    acc[s.exercise_name].push(s)
    return acc
  }, {})

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* ── Hero video ───────────────────────────────────────── */}
      {hero?.video_url ? (
        <PublicWorkoutVideoReel clips={clips} />
      ) : (
        <div
          className="flex h-32 items-end pb-5 px-5"
          style={{ background: 'linear-gradient(135deg, #166534, #16a34a)' }}
        />
      )}

      {/* ── Workout header ───────────────────────────────────── */}
      <div className="mx-auto max-w-lg px-5 py-6">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-zinc-400">{displayName}</p>
        <h1 className="text-2xl font-extrabold tracking-tight text-zinc-900">
          {workout.name?.trim() || 'Workout'}
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          {new Date(workout.created_at).toLocaleDateString(undefined, {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
          })}
        </p>

        {totalVolume > 0 && (
          <div className="mt-4 rounded-2xl border border-zinc-100 bg-white p-4 text-center shadow-sm">
            <p className="text-3xl font-bold text-zinc-900">
              {new Intl.NumberFormat('en-US').format(totalVolume)} lbs
            </p>
            <p className="text-xs text-zinc-400">Total volume</p>
          </div>
        )}

        {/* ── Per-exercise breakdown ───────────────────────── */}
        <div className="mt-6 flex flex-col gap-4">
          {Object.entries(grouped).map(([exercise, exSets]) => {
            const best = exSets.reduce((b, s) => s.weight > b.weight ? s : b, exSets[0])
            return (
              <div key={exercise} className="rounded-2xl border border-zinc-100 bg-white p-4 shadow-sm">
                <p className="font-semibold text-zinc-800">{exercise}</p>
                <p className="mt-0.5 text-xs text-zinc-400">
                  {exSets.length} set{exSets.length !== 1 ? 's' : ''} · best {best.weight} lbs × {best.reps}
                </p>
                <ul className="mt-3 space-y-1.5">
                  {exSets.map((s, i) => (
                    <li key={s.id} className="flex items-center justify-between text-sm">
                      <span className="text-zinc-400">Set {i + 1}</span>
                      <span className="font-medium text-zinc-700">
                        {s.weight} lbs × {s.reps}
                        {s.rpe != null && (
                          <span className="ml-2 text-xs text-zinc-400">RPE {s.rpe}</span>
                        )}
                      </span>
                      {s.video_url && (
                        <span className="ml-2 rounded-lg bg-zinc-50 px-2 py-0.5 text-xs font-semibold text-zinc-500">
                          {s.id === hero?.id ? 'Playing above + in reel' : 'Clip available in reel'}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>

        {/* ── Footer CTA ───────────────────────────────────── */}
        <div className="mt-10 rounded-2xl border border-zinc-100 bg-white p-6 text-center shadow-sm">
          <p className="text-sm font-semibold text-zinc-700">Track your lifts with LFD</p>
          <p className="mt-1 text-xs text-zinc-400">Log sets, get PRs, jork your friends</p>
          <a
            href="/"
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-sm font-bold text-white transition hover:opacity-90"
            style={{ background: 'linear-gradient(135deg, #166534, #16a34a)' }}
          >
            Open LFD
          </a>
        </div>
      </div>
    </div>
  )
}

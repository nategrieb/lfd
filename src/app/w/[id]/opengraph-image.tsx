import { ImageResponse } from 'next/og'
import { createClient } from '@supabase/supabase-js'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

export const runtime = 'nodejs'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

type SetRow = {
  exercise_name: string
  weight: number
  reps: number
  video_url: string | null
}

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  )

  const [{ data: workout }, fontData] = await Promise.all([
    supabase
      .from('workouts')
      .select('id, name, created_at, user_id')
      .eq('id', id)
      .maybeSingle(),
    readFile(path.join(process.cwd(), 'public', 'fonts', 'NotoSans-Bold.ttf')),
  ])

  if (!workout) {
    // Fallback branded card
    return new ImageResponse(
      <div
        style={{
          width: 1200, height: 630, display: 'flex', alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #166534 0%, #16a34a 100%)',
        }}
      >
        <span style={{ color: 'white', fontSize: 80, fontWeight: 800 }}>LFD</span>
      </div>,
      { width: 1200, height: 630, fonts: [{ name: 'Noto', data: fontData, weight: 700 }] },
    )
  }

  const [{ data: rawSets }, { data: profile }] = await Promise.all([
    supabase
      .from('sets')
      .select('exercise_name, weight, reps, video_url')
      .eq('workout_id', id)
      .order('created_at', { ascending: true }),
    supabase
      .from('profiles')
      .select('display_name, username')
      .eq('id', workout.user_id)
      .maybeSingle(),
  ])

  const sets = (rawSets ?? []) as SetRow[]
  const displayName = profile?.display_name ?? profile?.username ?? 'Someone'
  const workoutName = workout.name?.trim() || new Date(workout.created_at).toLocaleDateString()

  const totalVolume = sets.reduce((acc, s) => acc + s.weight * s.reps, 0)
  const exerciseCount = new Set(sets.map(s => s.exercise_name)).size

  // Top set: best weight (with video preferred)
  const withVideo = sets.filter(s => s.video_url)
  const pool = withVideo.length ? withVideo : sets
  const topS = pool.length
    ? pool.reduce((b, s) => s.weight * s.reps > b.weight * b.reps ? s : b)
    : null

  const dateStr = new Date(workout.created_at).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  })

  return new ImageResponse(
    <div
      style={{
        width: 1200,
        height: 630,
        display: 'flex',
        flexDirection: 'column',
        background: 'linear-gradient(135deg, #14532d 0%, #166534 45%, #15803d 100%)',
        fontFamily: 'Noto, sans-serif',
        padding: '60px 72px',
        position: 'relative',
      }}
    >
      {/* Top row: LFD badge + date */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 48 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(255,255,255,0.15)',
            borderRadius: 16,
            padding: '10px 24px',
          }}
        >
          <span style={{ color: 'white', fontSize: 28, fontWeight: 800, letterSpacing: '-0.5px' }}>LFD</span>
        </div>
        <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: 26 }}>{dateStr}</span>
      </div>

      {/* Athlete + workout name */}
      <div style={{ display: 'flex', flexDirection: 'column', marginBottom: 'auto' }}>
        <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: 30, marginBottom: 10 }}>
          {displayName}
        </span>
        <span style={{ color: 'white', fontSize: 72, fontWeight: 800, lineHeight: 1.05, letterSpacing: '-2px' }}>
          {workoutName}
        </span>
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 24, marginTop: 52 }}>
        {totalVolume > 0 && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              background: 'rgba(255,255,255,0.12)',
              borderRadius: 20,
              padding: '20px 32px',
              flex: 1,
            }}
          >
            <span style={{ color: 'white', fontSize: 42, fontWeight: 800, letterSpacing: '-1px' }}>
              {new Intl.NumberFormat('en-US').format(totalVolume)}
            </span>
            <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: 22, marginTop: 4 }}>lbs total volume</span>
          </div>
        )}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            background: 'rgba(255,255,255,0.12)',
            borderRadius: 20,
            padding: '20px 32px',
            flex: 1,
          }}
        >
          <span style={{ color: 'white', fontSize: 42, fontWeight: 800 }}>
            {sets.length} sets
          </span>
          <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: 22, marginTop: 4 }}>
            across {exerciseCount} exercise{exerciseCount !== 1 ? 's' : ''}
          </span>
        </div>
        {topS && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              background: 'rgba(255,255,255,0.12)',
              borderRadius: 20,
              padding: '20px 32px',
              flex: 1,
            }}
          >
            <span style={{ color: 'white', fontSize: 42, fontWeight: 800 }}>
              {topS.weight} × {topS.reps}
            </span>
            <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: 22, marginTop: 4 }}>
              top set · {topS.exercise_name}
            </span>
          </div>
        )}
      </div>
    </div>,
    {
      width: 1200,
      height: 630,
      fonts: [{ name: 'Noto', data: fontData, weight: 700 }],
    },
  )
}

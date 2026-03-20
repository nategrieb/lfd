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
  rpe: number | null
  video_url: string | null
  thumbnail_url: string | null
}

function deriveThumbFromVideoUrl(videoUrl: string): string | null {
  try {
    const url = new URL(videoUrl)
    const m = url.pathname.match(/\/(.+)-(\d+)\.mp4$/)
    if (!m) return null
    const setId = m[1]
    const version = m[2]
    url.pathname = url.pathname.replace(/\/(.+)-(\d+)\.mp4$/, `/${setId}-thumb-${version}.jpg`)
    return url.toString()
  } catch {
    return null
  }
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
    readFile(path.join(process.cwd(), 'public', 'fonts', 'NotoSans-Bold.ttf')).catch(() => null),
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
      {
        width: 1200,
        height: 630,
        ...(fontData ? { fonts: [{ name: 'Noto', data: fontData, weight: 700 }] } : {}),
      },
    )
  }

  const [{ data: rawSets }, { data: profile }] = await Promise.all([
    supabase
      .from('sets')
      .select('exercise_name, weight, reps, rpe, video_url, thumbnail_url')
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

  // Top set: best weight (with video preferred)
  const withVideo = sets.filter(s => s.video_url)
  const pool = withVideo.length ? withVideo : sets
  const topS = pool.length
    ? pool.reduce((b, s) => s.weight * s.reps > b.weight * b.reps ? s : b)
    : null

  const previewImage = topS?.thumbnail_url
    ?? (topS?.video_url ? deriveThumbFromVideoUrl(topS.video_url) : null)

  const metaLine = topS
    ? `${topS.weight} lbs × ${topS.reps}${topS.rpe != null ? `  •  RPE ${topS.rpe}` : ''}`
    : `${new Intl.NumberFormat('en-US').format(totalVolume)} lbs total`

  return new ImageResponse(
    <div
      style={{
        width: 1200,
        height: 630,
        display: 'flex',
        flexDirection: 'column',
        background: '#0f0f10',
        fontFamily: 'Noto, sans-serif',
        padding: '0',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {previewImage ? (
        <>
          <img
            src={previewImage}
            alt="Workout thumbnail"
            width={1200}
            height={630}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(to bottom, rgba(0,0,0,0.28), rgba(0,0,0,0.08) 40%, rgba(0,0,0,0.32))',
            }}
          />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '28px 34px 0 34px', zIndex: 2 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 34,
                  height: 34,
                  background: 'linear-gradient(135deg, #166534, #16a34a)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 4,
                }}
              >
                <span style={{ color: 'white', fontSize: 15, fontWeight: 800 }}>LFD</span>
              </div>
              <span style={{ color: 'white', fontSize: 44, fontWeight: 800 }}>{topS?.exercise_name?.toUpperCase() ?? 'WORKOUT'}</span>
            </div>

            <div style={{ display: 'inline-flex', alignItems: 'center', maxWidth: 1000, background: 'rgba(0,0,0,0.55)', borderRadius: 12, padding: '9px 14px', borderLeft: '4px solid #16a34a' }}>
              <span style={{ color: '#f4f4f5', fontSize: 35, fontWeight: 700 }}>{metaLine}</span>
            </div>
          </div>

          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: 112,
              height: 112,
              borderRadius: 999,
              transform: 'translate(-50%, -54%)',
              background: 'rgba(0,0,0,0.42)',
              border: '2px solid rgba(255,255,255,0.65)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                marginLeft: 8,
                width: 0,
                height: 0,
                borderTop: '20px solid transparent',
                borderBottom: '20px solid transparent',
                borderLeft: '30px solid white',
              }}
            />
          </div>
        </>
      ) : (
        <>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'radial-gradient(1000px 420px at 80% -10%, rgba(22,163,74,0.35), transparent 60%), radial-gradient(700px 300px at -10% 100%, rgba(22,163,74,0.28), transparent 70%)',
            }}
          />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '44px 56px 0 56px', zIndex: 2 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 42,
                  height: 42,
                  background: 'linear-gradient(135deg, #166534, #16a34a)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 6,
                }}
              >
                <span style={{ color: 'white', fontSize: 18, fontWeight: 800, letterSpacing: '-0.5px' }}>LFD</span>
              </div>
              <span style={{ color: 'white', fontSize: 48, fontWeight: 800, letterSpacing: '-1px' }}>{topS?.exercise_name?.toUpperCase() ?? 'WORKOUT'}</span>
            </div>

            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                maxWidth: 1040,
                background: 'rgba(0,0,0,0.55)',
                borderRadius: 14,
                padding: '12px 18px',
                borderLeft: '5px solid #16a34a',
              }}
            >
              <span style={{ color: '#f4f4f5', fontSize: 40, fontWeight: 700, letterSpacing: '-0.5px' }}>{metaLine}</span>
            </div>

            <div style={{ marginTop: 8, color: 'rgba(255,255,255,0.9)', fontSize: 42, fontWeight: 700, lineHeight: 1.1 }}>
              {displayName}'s workout
            </div>
            <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 52, fontWeight: 800, letterSpacing: '-1px', maxWidth: 1040, lineHeight: 1.05 }}>
              {workoutName}
            </div>
          </div>
        </>
      )}

      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: 122,
          background: 'linear-gradient(135deg, #166534, #16a34a)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 56px',
          zIndex: 3,
        }}
      >
        <span style={{ color: 'white', fontSize: 44, fontWeight: 800, letterSpacing: '-0.6px' }}>
          Open In LFD Reels
        </span>
        <span style={{ color: 'rgba(255,255,255,0.95)', fontSize: 28, fontWeight: 700 }}>
          {new Intl.NumberFormat('en-US').format(totalVolume)} lbs total
        </span>
      </div>
    </div>,
    {
      width: 1200,
      height: 630,
      ...(fontData ? { fonts: [{ name: 'Noto', data: fontData, weight: 700 }] } : {}),
    },
  )
}

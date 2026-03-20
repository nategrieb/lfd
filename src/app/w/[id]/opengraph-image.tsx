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
    url.pathname = url.pathname.replace(/\/(.+)-(\d+)\.mp4$/, `/${m[1]}-thumb-${m[2]}.jpg`)
    return url.toString()
  } catch {
    return null
  }
}

/** British Racing Green square badge — same in both card variants */
function LfdBadge({ size: s = 72 }: { size?: number }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: s,
        height: s,
        background: 'rgba(0,0,0,0.38)',
        borderRadius: Math.round(s * 0.17),
        flexShrink: 0,
      }}
    >
      <span style={{ color: 'white', fontSize: Math.round(s * 0.34), fontWeight: 800, letterSpacing: '-0.5px' }}>
        LFD
      </span>
    </div>
  )
}

function fallbackCard(fontData: Buffer | null) {
  return new ImageResponse(
    <div
      style={{
        width: 1200,
        height: 630,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(160deg, #14532d 0%, #166534 100%)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 100,
          height: 100,
          background: 'rgba(0,0,0,0.38)',
          borderRadius: 16,
        }}
      >
        <span style={{ color: 'white', fontSize: 34, fontWeight: 800 }}>LFD</span>
      </div>
    </div>,
    {
      width: 1200,
      height: 630,
      ...(fontData ? { fonts: [{ name: 'Noto', data: fontData, weight: 700 as const }] } : {}),
    },
  )
}

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const fontData = await readFile(
    path.join(process.cwd(), 'public', 'fonts', 'NotoSans-Bold.ttf'),
  ).catch(() => null)
  const fonts = fontData ? [{ name: 'Noto', data: fontData, weight: 700 as const }] : []

  try {
    const { id } = await params

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    )

    const { data: workout } = await supabase
      .from('workouts')
      .select('id, name, created_at, user_id')
      .eq('id', id)
      .maybeSingle()

    if (!workout) return fallbackCard(fontData)

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
    const workoutName = workout.name?.trim() || 'Workout'
    const dateStr = new Date(workout.created_at).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })

    const totalVolume = sets.reduce((acc, s) => acc + s.weight * s.reps, 0)
    const volumeStr = new Intl.NumberFormat('en-US').format(totalVolume)
    const exerciseCount = new Set(sets.map((s) => s.exercise_name)).size

    // Top set: prefer one with video, then best weight × reps
    const withVideo = sets.filter((s) => s.video_url)
    const pool = withVideo.length ? withVideo : sets
    const topS = pool.length
      ? pool.reduce((b, s) => s.weight * s.reps > b.weight * b.reps ? s : b)
      : null

    // Thumbnail resolution (stored URL first, derived path fallback)
    const firstVideoSet = sets.find((s) => s.video_url)
    const thumbUrl =
      firstVideoSet?.thumbnail_url ??
      (firstVideoSet?.video_url ? deriveThumbFromVideoUrl(firstVideoSet.video_url) : null)

    // ─── VIDEO CARD: thumbnail bg + British Racing Green branded strip ─────
    if (thumbUrl) {
      const statLine = topS
        ? `${topS.weight} lbs × ${topS.reps}${topS.rpe != null ? `  ·  RPE ${topS.rpe}` : ''}`
        : `${volumeStr} lbs total`

      return new ImageResponse(
        <div
          style={{
            width: 1200,
            height: 630,
            display: 'flex',
            position: 'relative',
            overflow: 'hidden',
            background: '#000',
          }}
        >
          {/* Thumbnail fills frame */}
          <img
            src={thumbUrl}
            width={1200}
            height={630}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
          {/* Soft gradient fade above the green strip */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 110,
              height: 160,
              background: 'linear-gradient(to top, rgba(0,0,0,0.65) 0%, transparent 100%)',
              display: 'flex',
            }}
          />
          {/* British Racing Green strip */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              height: 110,
              background: 'linear-gradient(90deg, #14532d 0%, #166534 60%, #166534 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 52px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
              <LfdBadge size={68} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span
                  style={{
                    color: 'white',
                    fontSize: 30,
                    fontWeight: 800,
                    letterSpacing: '-0.5px',
                    lineHeight: 1,
                    fontFamily: 'Noto, sans-serif',
                  }}
                >
                  {workoutName}
                </span>
                <span
                  style={{
                    color: 'rgba(255,255,255,0.75)',
                    fontSize: 22,
                    fontWeight: 700,
                    lineHeight: 1,
                    fontFamily: 'Noto, sans-serif',
                  }}
                >
                  {displayName}
                </span>
              </div>
            </div>
            <span
              style={{
                color: 'rgba(255,255,255,0.9)',
                fontSize: 26,
                fontWeight: 700,
                fontFamily: 'Noto, sans-serif',
              }}
            >
              {statLine}
            </span>
          </div>
        </div>,
        { width: 1200, height: 630, fonts },
      )
    }

    // ─── STATS CARD: full British Racing Green card with workout stats ─────
    return new ImageResponse(
      <div
        style={{
          width: 1200,
          height: 630,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: 'linear-gradient(160deg, #14532d 0%, #166534 60%, #15803d 100%)',
          fontFamily: 'Noto, sans-serif',
          padding: '48px 56px',
        }}
      >
        {/* Top row: square LFD badge + date */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <LfdBadge size={72} />
          <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 28, fontWeight: 700 }}>{dateStr}</span>
        </div>

        {/* Name + workout title */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: 30, fontWeight: 700 }}>
            {displayName}
          </span>
          <span
            style={{
              color: 'white',
              fontSize: 68,
              fontWeight: 800,
              letterSpacing: '-1.5px',
              lineHeight: 1.0,
              maxWidth: '85%',
            }}
          >
            {workoutName}
          </span>
        </div>

        {/* Bottom section: stat boxes + footer */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Stat boxes */}
          <div style={{ display: 'flex', gap: 16 }}>
            <div
              style={{
                flex: 1,
                background: 'rgba(0,0,0,0.28)',
                borderRadius: 16,
                padding: '18px 24px',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              <span style={{ color: 'white', fontSize: 42, fontWeight: 800, lineHeight: 1 }}>{volumeStr}</span>
              <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 20, fontWeight: 700 }}>
                lbs total volume
              </span>
            </div>
            <div
              style={{
                flex: 1,
                background: 'rgba(0,0,0,0.28)',
                borderRadius: 16,
                padding: '18px 24px',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              <span style={{ color: 'white', fontSize: 42, fontWeight: 800, lineHeight: 1 }}>
                {sets.length} sets
              </span>
              <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 20, fontWeight: 700 }}>
                across {exerciseCount} exercise{exerciseCount !== 1 ? 's' : ''}
              </span>
            </div>
            {topS && (
              <div
                style={{
                  flex: 1,
                  background: 'rgba(0,0,0,0.28)',
                  borderRadius: 16,
                  padding: '18px 24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
                <span style={{ color: 'white', fontSize: 42, fontWeight: 800, lineHeight: 1 }}>
                  {topS.weight} × {topS.reps}
                </span>
                <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 20, fontWeight: 700 }}>
                  top set · {topS.exercise_name}
                </span>
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 24, fontWeight: 700 }}>
              {displayName}&apos;s workout — {workoutName}
            </span>
            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 22, fontWeight: 700 }}>
              lfd.nategrieb.com
            </span>
          </div>
        </div>
      </div>,
      { width: 1200, height: 630, fonts },
    )
  } catch {
    // Never return a 500 — bots always get a branded image.
    return fallbackCard(fontData)
  }
}

'use client'

export type ChartPoint = {
  date: string
  e1rm: number
  weight: number
  reps: number
}

export default function LiftChart({ data }: { data: ChartPoint[] }) {
  if (data.length < 2) return null

  const W = 400
  const H = 80
  const PAD = { t: 10, r: 8, b: 6, l: 8 }
  const innerW = W - PAD.l - PAD.r
  const innerH = H - PAD.t - PAD.b

  const values = data.map(d => d.e1rm)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const maxIdx = values.indexOf(max)

  const toX = (i: number) => PAD.l + (i / (data.length - 1)) * innerW
  const toY = (v: number) => PAD.t + (1 - (v - min) / range) * innerH

  const pts = data.map((d, i) => ({ x: toX(i), y: toY(d.e1rm), ...d }))
  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
  const areaPath = [
    `M ${pts[0].x.toFixed(1)} ${(H - PAD.b).toFixed(1)}`,
    ...pts.map(p => `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`),
    `L ${pts[pts.length - 1].x.toFixed(1)} ${(H - PAD.b).toFixed(1)}`,
    'Z',
  ].join(' ')

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      height={H}
      role="img"
      aria-label="Estimated 1RM progress chart"
    >
      <defs>
        <linearGradient id="lift-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#E8B84B" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#E8B84B" stopOpacity="0.03" />
        </linearGradient>
      </defs>

      {/* Area fill */}
      <path d={areaPath} fill="url(#lift-area)" />

      {/* Line */}
      <path
        d={linePath}
        fill="none"
        stroke="#E8B84B"
        strokeWidth="1.8"
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* Points — PR highlighted in amber */}
      {pts.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={i === maxIdx ? 4 : 2.5}
          fill={i === maxIdx ? '#E8B84B' : '#3f3f46'}
          stroke={i === maxIdx ? '#fbbf24' : '#71717a'}
          strokeWidth="1"
        />
      ))}
    </svg>
  )
}

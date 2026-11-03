'use client'

export type ChartPoint = {
  date: string
  e1rm: number
  weight: number
  reps: number
}

/** Round the axis to friendly numbers (multiples of 5/10/25...) so the labels read cleanly. */
function niceAxis(min: number, max: number) {
  const span = Math.max(max - min, 1)
  const rough = span / 3
  const pow = 10 ** Math.floor(Math.log10(rough))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= rough) ?? 10 * pow
  const lo = Math.floor(min / step) * step
  const hi = Math.ceil(max / step) * step
  const ticks: number[] = []
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v * 100) / 100)
  return { lo, hi: hi === lo ? lo + step : hi, ticks }
}

const fmtMonth = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: 'short', year: '2-digit' })

export default function LiftChart({ data, unit = 'lbs' }: { data: ChartPoint[]; unit?: string }) {
  if (data.length < 2) return null

  const W = 400
  const H = 170
  const PAD = { t: 12, r: 12, b: 24, l: 40 }
  const innerW = W - PAD.l - PAD.r
  const innerH = H - PAD.t - PAD.b

  const values = data.map((d) => d.e1rm)
  const { lo, hi, ticks } = niceAxis(Math.min(...values), Math.max(...values))
  const maxIdx = values.indexOf(Math.max(...values))

  const toX = (i: number) => PAD.l + (i / (data.length - 1)) * innerW
  const toY = (v: number) => PAD.t + (1 - (v - lo) / (hi - lo)) * innerH

  const pts = data.map((d, i) => ({ x: toX(i), y: toY(d.e1rm), ...d }))
  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
  const baseY = PAD.t + innerH
  const areaPath = [`M ${pts[0].x.toFixed(1)} ${baseY}`, ...pts.map((p) => `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`), `L ${pts[pts.length - 1].x.toFixed(1)} ${baseY}`, 'Z'].join(' ')

  // A few evenly spaced dates along the bottom.
  const xLabelIdx = Array.from(new Set([0, Math.round((data.length - 1) / 2), data.length - 1]))

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`Estimated 1RM progress, ${unit}`}>
      <defs>
        <linearGradient id="lift-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#166534" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#166534" stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {/* Y axis: gridlines and the value at each */}
      {ticks.map((t) => (
        <g key={t}>
          <line x1={PAD.l} x2={W - PAD.r} y1={toY(t)} y2={toY(t)} stroke="#e4e4e7" strokeWidth="1" strokeDasharray={t === lo ? undefined : '3 3'} />
          <text x={PAD.l - 6} y={toY(t) + 3.5} textAnchor="end" fontSize="10" fill="#71717a">
            {t}
          </text>
        </g>
      ))}
      <text x={PAD.l - 6} y={PAD.t - 3} textAnchor="end" fontSize="8" fill="#a1a1aa">
        {unit}
      </text>

      <path d={areaPath} fill="url(#lift-area)" />
      <path d={linePath} fill="none" stroke="#166534" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />

      {/* Points — the best one is highlighted and labelled */}
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={i === maxIdx ? 4 : 2.5} fill={i === maxIdx ? '#16a34a' : '#e4e4e7'} stroke={i === maxIdx ? '#166534' : '#a1a1aa'} strokeWidth="1" />
      ))}
      <text
        x={Math.min(Math.max(pts[maxIdx].x, PAD.l + 14), W - PAD.r - 14)}
        y={Math.max(pts[maxIdx].y - 8, 9)}
        textAnchor="middle"
        fontSize="10"
        fontWeight="700"
        fill="#166534"
      >
        {pts[maxIdx].e1rm}
      </text>

      {/* X axis: dates */}
      {xLabelIdx.map((i) => (
        <text key={i} x={toX(i)} y={H - 6} textAnchor={i === 0 ? 'start' : i === data.length - 1 ? 'end' : 'middle'} fontSize="10" fill="#71717a">
          {fmtMonth(data[i].date)}
        </text>
      ))}
    </svg>
  )
}

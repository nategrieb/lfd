/**
 * overlay-canvas.ts
 *
 * Renders the LFD branded burn-in overlay onto a Canvas element.
 * Extracted so it can be used in both VideoUpload (for FFmpeg compositing)
 * and the /overlay-preview dev tool for instant live iteration.
 *
 * Design: broadcast lower-third split card
 *   ┌──────┬───────────────────────────────┐
 *   │      │  EXERCISE NAME               │
 *   │ LFD  │  255 lbs × 3  ·  RPE 9       │
 *   └──────┴───────────────────────────────┘
 * All dimensions scale with the video's short edge, so the card looks
 * the same proportionally on any aspect ratio (landscape / portrait / square).
 */

const GREEN_DARK = '#166534'
const GREEN_MID  = '#16a34a'
const FONT = 'system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif'

export type OverlayData = {
  exerciseName: string
  weight: number
  reps: number
  rpe?: number | null
  oneRepMax?: number | null
  /** Cardio: distance in metres (0 or null for strength sets). */
  distanceM?: number | null
  /** Cardio: duration in seconds (0 or null for strength sets). */
  durationSeconds?: number | null
}

/** Detects whether the set is a cardio set. */
function isCardioSet(data: OverlayData): boolean {
  return (
    (data.distanceM ?? 0) > 0 ||
    ((data.durationSeconds ?? 0) > 0 && data.weight === 0 && data.reps === 0)
  )
}

function fmtDistance(meters: number): string {
  return `${(meters / 1609.344).toFixed(2)} mi`
}

function fmtDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

/**
 * Renders the overlay directly onto the provided canvas element.
 * The canvas dimensions are set to videoWidth × videoHeight.
 * All pixels outside the overlay elements are fully transparent.
 */
export function renderOverlayCanvas(
  data: OverlayData,
  videoWidth: number,
  videoHeight: number,
  canvas: HTMLCanvasElement,
): void {
  const W = videoWidth
  const H = videoHeight
  canvas.width  = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.clearRect(0, 0, W, H)

  // All pixel measurements normalised to the short edge at 1080 px.
  const scale      = Math.min(W, H) / 1080
  const edgePad    = Math.round(20 * scale)
  const cardRadius = Math.round(10 * scale)
  const lfdW       = Math.round(64 * scale)   // width of the green LFD pill section
  const padX       = Math.round(18 * scale)   // horizontal text padding inside right block
  const padY       = Math.round(13 * scale)   // vertical padding inside card
  const lineGap    = Math.round(5  * scale)
  const titleSize  = Math.round(34 * scale)
  const detailSize = Math.round(21 * scale)
  const maxTextW   = Math.round(Math.min(W, H) * 0.62)  // truncation limit

  // ── Build text content ───────────────────────────────────────────────────
  const title = data.exerciseName.toUpperCase()

  let detailText: string
  if (isCardioSet(data)) {
    const parts: string[] = []
    if ((data.distanceM ?? 0) > 0)      parts.push(fmtDistance(data.distanceM!))
    if ((data.durationSeconds ?? 0) > 0) parts.push(fmtDuration(data.durationSeconds!))
    detailText = parts.join('  ·  ')
  } else {
    const parts = [`${data.weight} lbs × ${data.reps}`]
    if (data.rpe   != null)              parts.push(`RPE ${data.rpe}`)
    if (data.oneRepMax && data.weight > 0)
      parts.push(`${Math.round((data.weight / data.oneRepMax) * 100)}% 1RM`)
    detailText = parts.join('  ·  ')
  }

  // Measure widths (truncating if needed)
  ctx.font = `800 ${titleSize}px ${FONT}`
  let titleClipped = title
  while (ctx.measureText(titleClipped).width > maxTextW && titleClipped.length > 1)
    titleClipped = titleClipped.slice(0, -1)
  const titleW = ctx.measureText(titleClipped).width

  ctx.font = `600 ${detailSize}px ${FONT}`
  const detailW = Math.min(ctx.measureText(detailText).width, maxTextW)

  // ── Card geometry ────────────────────────────────────────────────────────
  const contentW = padX + Math.max(titleW, detailW) + padX
  const cardH    = padY + titleSize + lineGap + detailSize + padY
  const cardX    = edgePad
  const cardY    = edgePad

  // ── Left green LFD block (left-rounded, flush-right) ────────────────────
  const lfdGrad = ctx.createLinearGradient(cardX, cardY, cardX, cardY + cardH)
  lfdGrad.addColorStop(0, GREEN_DARK)
  lfdGrad.addColorStop(1, '#15803d')
  ctx.fillStyle = lfdGrad
  ctx.beginPath()
  ctx.roundRect(cardX, cardY, lfdW, cardH, [cardRadius, 0, 0, cardRadius])
  ctx.fill()

  // "LFD" label centred in the green block
  ctx.fillStyle    = '#FFFFFF'
  ctx.textAlign    = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `900 ${Math.round(lfdW * 0.30)}px ${FONT}`
  ctx.fillText('LFD', cardX + lfdW / 2, cardY + cardH / 2)

  // ── Right dark content block (right-rounded, flush-left) ────────────────
  const rightX = cardX + lfdW
  ctx.fillStyle = 'rgba(10, 10, 10, 0.82)'
  ctx.beginPath()
  ctx.roundRect(rightX, cardY, contentW, cardH, [0, cardRadius, cardRadius, 0])
  ctx.fill()

  const textX = rightX + padX
  const row1Y = cardY + padY

  // Exercise name — white, bold
  ctx.fillStyle    = '#FFFFFF'
  ctx.textAlign    = 'left'
  ctx.textBaseline = 'top'
  ctx.font = `800 ${titleSize}px ${FONT}`
  ctx.fillText(titleClipped, textX, row1Y)

  // Stats line — zinc-400, semibold
  ctx.fillStyle = '#A1A1AA'
  ctx.font = `600 ${detailSize}px ${FONT}`
  ctx.fillText(detailText, textX, row1Y + titleSize + lineGap)

  // ── Bottom-right corner LFD watermark ────────────────────────────────────
  const cornerSz  = Math.round(Math.min(W, H) * 0.048)
  const cornerPad = Math.round(edgePad * 0.85)
  const cX = W - cornerSz - cornerPad
  const cY = H - cornerSz - cornerPad
  const cGrad = ctx.createLinearGradient(cX, cY, cX + cornerSz, cY + cornerSz)
  cGrad.addColorStop(0, GREEN_DARK)
  cGrad.addColorStop(1, GREEN_MID)
  ctx.fillStyle = cGrad
  ctx.fillRect(cX, cY, cornerSz, cornerSz)
  ctx.fillStyle    = '#FFFFFF'
  ctx.textAlign    = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `900 ${Math.round(cornerSz * 0.33)}px ${FONT}`
  ctx.fillText('LFD', cX + cornerSz / 2, cY + cornerSz / 2)
}

/**
 * Renders the overlay and returns a Uint8Array PNG bytes — used by
 * VideoUpload to supply the FFmpeg overlay input file.
 */
export function renderOverlayPng(
  data: OverlayData,
  videoWidth: number,
  videoHeight: number,
): Promise<Uint8Array<ArrayBuffer>> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas')
    renderOverlayCanvas(data, videoWidth, videoHeight, canvas)
    canvas.toBlob(
      (blob) => {
        if (!blob) { reject(new Error('Canvas toBlob failed')); return }
        blob.arrayBuffer().then(
          (buf) => resolve(new Uint8Array(buf) as Uint8Array<ArrayBuffer>),
          reject,
        )
      },
      'image/png',
    )
  })
}

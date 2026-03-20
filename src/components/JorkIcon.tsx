// Combined fist-pound-into-bean icon for the Jork action.
// Layout: [fist][bean][lines]  — fist and bean touching, lines tight to the right.
export default function JorkIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 44 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* ── Fist (right-facing punch) ──────────────────────── */}
      {/* Knuckle block — right edge at x=15 */}
      <rect x="1" y="5" width="14" height="12" rx="2.5" fill="currentColor" />
      {/* Thumb stub */}
      <path d="M2 15 Q1 20 6 20 L10 20 Q13 20 13 16" fill="currentColor" />

      {/* ── Kidney bean — left edge at x=16, notch faces left toward fist ── */}
      {/*
        Bean sits x=16..30, centred vertically.
        The concavity (notch) is on the LEFT side so the fist looks like
        it's punching right into the dent.
      */}
      <path
        d="
          M 23 3
          C 30 3,  31 8,  31 12
          C 31 17, 28 21, 24 21
          C 19 21, 16 18, 16 15
          C 16 12, 18 10, 21 12
          C 23 13, 23 15, 21 16
          C 18 17, 17 15, 17 12
          C 17  7, 19  3, 23  3
          Z
        "
        fill="currentColor"
      />

      {/* ── Motion lines — right of the bean, x=33..40 ─────── */}
      <line x1="33" y1="9"  x2="40" y2="9"  stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="33" y1="12" x2="42" y2="12" stroke="currentColor" strokeWidth="2"   strokeLinecap="round" />
      <line x1="33" y1="15" x2="40" y2="15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}


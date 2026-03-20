'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

// Impact point — roughly "your face"
const IX = 50 // % from left
const IY = 38 // % from top

// Radial droplets that explode outward from the impact point.
// ang: 0 = right, 90 = down, -90 = up (degrees)
// r  : short-axis px   len: long-axis px   dist: travel in vmin
const DROPS: Array<{ang:number;dist:number;r:number;len:number;dur:number;del:number;op:number}> = [
  { ang: -100, dist: 55, r:  8, len: 22, dur: 1.05, del: 0.00, op: 0.88 },
  { ang:  -80, dist: 72, r: 10, len: 30, dur: 1.22, del: 0.01, op: 0.90 },
  { ang:  -60, dist: 80, r:  8, len: 26, dur: 1.18, del: 0.00, op: 0.86 },
  { ang:  -40, dist: 65, r:  7, len: 20, dur: 1.08, del: 0.02, op: 0.82 },
  { ang:  -20, dist: 58, r:  6, len: 17, dur: 0.98, del: 0.03, op: 0.79 },
  { ang:    5, dist: 68, r:  9, len: 27, dur: 1.15, del: 0.01, op: 0.87 },
  { ang:   25, dist: 78, r: 11, len: 33, dur: 1.26, del: 0.00, op: 0.91 },
  { ang:   45, dist: 70, r:  9, len: 28, dur: 1.18, del: 0.02, op: 0.86 },
  { ang:   65, dist: 82, r: 10, len: 32, dur: 1.28, del: 0.01, op: 0.89 },
  { ang:   90, dist: 70, r: 12, len: 38, dur: 1.40, del: 0.00, op: 0.93 },
  { ang:  108, dist: 88, r: 13, len: 42, dur: 1.45, del: 0.01, op: 0.92 },
  { ang:  125, dist: 80, r: 11, len: 36, dur: 1.35, del: 0.02, op: 0.90 },
  { ang:  145, dist: 72, r: 10, len: 30, dur: 1.25, del: 0.01, op: 0.88 },
  { ang:  165, dist: 55, r:  8, len: 22, dur: 1.10, del: 0.03, op: 0.83 },
  { ang: -120, dist: 62, r:  9, len: 26, dur: 1.12, del: 0.02, op: 0.85 },
  { ang: -140, dist: 50, r:  7, len: 20, dur: 1.00, del: 0.04, op: 0.80 },
  { ang: -160, dist: 45, r:  6, len: 16, dur: 0.95, del: 0.05, op: 0.77 },
  { ang:  172, dist: 48, r:  6, len: 16, dur: 0.95, del: 0.04, op: 0.76 },
  // Larger drops in the main downward burst
  { ang:   75, dist: 95, r: 14, len: 45, dur: 1.50, del: 0.00, op: 0.92 },
  { ang:  112, dist: 92, r: 15, len: 48, dur: 1.55, del: 0.01, op: 0.94 },
  { ang:  -70, dist: 75, r:  9, len: 29, dur: 1.22, del: 0.01, op: 0.87 },
]

// Tiny blobs that land on the "lens" and linger
const SPATTERS = [
  { x: 32, y: 24, r: 3.5, del: 0.08 },
  { x: 61, y: 18, r: 2.5, del: 0.06 },
  { x: 22, y: 38, r: 4.0, del: 0.11 },
  { x: 74, y: 31, r: 3.0, del: 0.07 },
  { x: 46, y: 16, r: 4.5, del: 0.05 },
  { x: 57, y: 49, r: 2.0, del: 0.09 },
  { x: 28, y: 53, r: 3.5, del: 0.13 },
  { x: 71, y: 23, r: 4.0, del: 0.06 },
  { x: 40, y: 59, r: 2.5, del: 0.10 },
  { x: 54, y: 13, r: 3.0, del: 0.04 },
  { x: 35, y: 66, r: 4.0, del: 0.12 },
  { x: 65, y: 56, r: 3.5, del: 0.08 },
]

// Thin rivulets that drip DOWN after the main hit (narrow pill-shapes)
const RIVULETS = [
  { l:  7, w: 3, dur: 1.70, del: 0.18, op: 0.68 },
  { l: 19, w: 5, dur: 1.90, del: 0.21, op: 0.72 },
  { l: 30, w: 3, dur: 1.75, del: 0.19, op: 0.65 },
  { l: 41, w: 6, dur: 2.00, del: 0.22, op: 0.70 },
  { l: 52, w: 4, dur: 1.65, del: 0.24, op: 0.67 },
  { l: 63, w: 5, dur: 1.85, del: 0.20, op: 0.71 },
  { l: 74, w: 3, dur: 1.95, del: 0.17, op: 0.68 },
  { l: 85, w: 6, dur: 2.10, del: 0.23, op: 0.66 },
  { l: 93, w: 4, dur: 1.72, del: 0.21, op: 0.64 },
]

// Hanging drips at the top edge
const DRIP_POS = [13, 30, 47, 63, 78, 92]

// Bottom ripple rings
const RIPPLES = [
  { l: 10, del: 0.55, scale: 6 },
  { l: 28, del: 0.62, scale: 8 },
  { l: 50, del: 0.58, scale: 7 },
  { l: 70, del: 0.65, scale: 9 },
  { l: 88, del: 0.60, scale: 6 },
]

const TOTAL_MS = 3200

export default function WaterSplash({ onDone }: { onDone: () => void }) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const t = setTimeout(onDone, TOTAL_MS)
    return () => clearTimeout(t)
  }, [onDone])

  if (!mounted) return null

  return createPortal(
    <>
      <style>{`
        @keyframes lfd-shake {
          0%       { transform: translate(0,    0);    }
          6%       { transform: translate(-6px,-8px);  }
          13%      { transform: translate( 7px, 5px);  }
          20%      { transform: translate(-5px, 7px);  }
          27%      { transform: translate( 6px,-4px);  }
          34%      { transform: translate(-3px, 5px);  }
          42%      { transform: translate( 4px,-6px);  }
          50%      { transform: translate(-2px, 3px);  }
          60%,100% { transform: translate(0,    0);    }
        }
        @keyframes lfd-flash {
          0%   { opacity: 0; }
          4%   { opacity: 1; }
          22%  { opacity: 0; }
          100% { opacity: 0; }
        }
        @keyframes lfd-bloom {
          0%   { transform: translate(-50%,-50%) scale(0.05); opacity: 1;   }
          55%  { transform: translate(-50%,-50%) scale(5);    opacity: 0.5; }
          100% { transform: translate(-50%,-50%) scale(9);    opacity: 0;   }
        }
        @keyframes lfd-tint {
          0%   { opacity: 0;    }
          5%   { opacity: 0.88; }
          55%  { opacity: 0.82; }
          100% { opacity: 0;    }
        }
        /*
          Radial droplet: teardrop shape, rotated to face direction of travel.
          translate() is the outermost function so it moves in screen space,
          leaving the rotation constant throughout.
        */
        @keyframes lfd-drop {
          0%   { transform: translate(0px,0px) rotate(var(--rot)) scale(1);               opacity: var(--op); }
          68%  { opacity: var(--op); }
          100% { transform: translate(var(--tx),var(--ty)) rotate(var(--rot)) scale(0.12); opacity: 0;         }
        }
        /* Small spatter circles: pop in, linger, fade */
        @keyframes lfd-spatter {
          0%   { transform: scale(0);   opacity: 0;    }
          14%  { transform: scale(1.3); opacity: 0.88; }
          40%  { transform: scale(1);   opacity: 0.80; }
          100% { transform: scale(1);   opacity: 0;    }
        }
        /* Thin rivulets run down as pill shapes */
        @keyframes lfd-rivulet {
          0%   { transform: translateY(-115vh); opacity: 0;          }
          7%   { opacity: var(--rop); }
          80%  { opacity: var(--rop); }
          100% { transform: translateY(115vh);  opacity: 0;          }
        }
        /* Drips grow down from top */
        @keyframes lfd-drip {
          0%   { height: 0;     opacity: 0.88; }
          35%  { height: 70px;  opacity: 0.82; }
          70%  { height: 115px; opacity: 0.65; }
          100% { height: 135px; opacity: 0;    }
        }
        /* Elliptical ripple rings */
        @keyframes lfd-ripple {
          0%   { transform: translateX(-50%) scale(0.1); opacity: 0.82; }
          100% { transform: translateX(-50%) scale(var(--rscale)); opacity: 0; }
        }
      `}</style>

      {/* Shake wrapper */}
      <div
        className="pointer-events-none fixed inset-0 z-[9999] overflow-hidden"
        style={{ animation: 'lfd-shake 0.55s cubic-bezier(0.36,0.07,0.19,0.97) both' }}
      >
        {/* Blue tint */}
        <div
          className="absolute inset-0"
          style={{
            animation: `lfd-tint ${TOTAL_MS}ms ease-out forwards`,
            background: 'linear-gradient(180deg,rgba(29,78,216,.20) 0%,rgba(59,130,246,.12) 40%,rgba(29,78,216,.16) 100%)',
            backdropFilter: 'blur(1.5px) brightness(0.93) saturate(1.2)',
          }}
        />

        {/* Impact flash */}
        <div
          className="absolute inset-0"
          style={{
            animation: `lfd-flash ${TOTAL_MS}ms ease-out forwards`,
            background: 'radial-gradient(ellipse at 50% 38%,rgba(219,234,254,.95) 0%,rgba(147,197,253,.6) 40%,transparent 70%)',
          }}
        />

        {/* Bloom ring */}
        <div
          style={{
            position: 'absolute',
            top: `${IY}%`,
            left: `${IX}%`,
            width: 90,
            height: 90,
            borderRadius: '50%',
            background: 'radial-gradient(circle,rgba(219,234,254,.9) 0%,rgba(96,165,250,.4) 55%,transparent 100%)',
            animation: 'lfd-bloom 0.7s cubic-bezier(0.2,0,0.4,1) 0s forwards',
          }}
        />

        {/* ── Radial droplets ── each is a teardrop aligned to direction of travel */}
        {DROPS.map((d, i) => {
          const rad = d.ang * (Math.PI / 180)
          const tx  = Math.cos(rad) * d.dist   // vmin
          const ty  = Math.sin(rad) * d.dist   // vmin
          // Rotate so the long axis points in the direction of travel.
          // Default element orientation is vertical (height > width),
          // so ang=90° (straight down) → rotation 0°; thus rot = ang − 90.
          const rot = d.ang - 90
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: `${IX}%`,
                top:  `${IY}%`,
                width:     d.r,
                height:    d.len,
                marginLeft: -(d.r   / 2),
                marginTop:  -(d.len / 2),
                // Classic water-droplet shape: rounded leading end, slightly narrower tail
                borderRadius: '50% 50% 40% 40% / 62% 62% 38% 38%',
                background: `radial-gradient(ellipse at 45% 32%,
                  rgba(219,234,254,.88),
                  rgba(96,165,250,${d.op}) 52%,
                  rgba(37,99,235,${d.op * 0.9}) 100%)`,
                filter: 'blur(0.7px)',
                ['--tx' as string]: `${tx}vmin`,
                ['--ty' as string]: `${ty}vmin`,
                ['--rot' as string]: `${rot}deg`,
                ['--op'  as string]: String(d.op),
                animation: `lfd-drop ${d.dur}s cubic-bezier(0.15,0,0.5,1) ${d.del}s both`,
              }}
            />
          )
        })}

        {/* ── Spatter blobs ── */}
        {SPATTERS.map((s, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              left:   `${s.x}%`,
              top:    `${s.y}%`,
              width:  s.r * 2,
              height: s.r * 2,
              borderRadius: '50%',
              background: 'radial-gradient(circle at 38% 34%,rgba(219,234,254,.92),rgba(96,165,250,.78) 58%,rgba(37,99,235,.65) 100%)',
              filter: 'blur(0.5px)',
              animation: `lfd-spatter 1.1s ease-out ${s.del}s both`,
            }}
          />
        ))}

        {/* ── Rivulets ── thin pill-shapes drip down */}
        {RIVULETS.map((rv, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `${rv.l}%`,
              top:  0,
              width:  rv.w,
              height: '100vh',
              borderRadius: 999, // pill — both ends semicircular
              ['--rop' as string]: String(rv.op),
              background: `linear-gradient(to bottom,
                transparent 0%,
                rgba(147,197,253,${rv.op}) 8%,
                rgba(96,165,250,${rv.op})  45%,
                rgba(186,230,253,${rv.op * 0.75}) 82%,
                transparent 100%)`,
              filter: 'blur(0.9px)',
              animation: `lfd-rivulet ${rv.dur}s cubic-bezier(0.3,0,0.65,1) ${rv.del}s both`,
            }}
          />
        ))}

        {/* ── Hanging drips ── rounded teardrop bottom */}
        {DRIP_POS.map((l, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              top:  0,
              left: `${l}%`,
              width: 5 + (i % 3) * 2,
              borderRadius: '0 0 999px 999px',
              background: 'rgba(96,165,250,.78)',
              filter: 'blur(0.8px)',
              animation: `lfd-drip 1.5s ease-in ${0.55 + i * 0.09}s forwards`,
            }}
          />
        ))}

        {/* ── Ripple rings at the bottom ── */}
        {RIPPLES.map((r, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              bottom: '2%',
              left:   `${r.l}%`,
              width:  50,
              height: 20,
              borderRadius: '50%',
              border: '2.5px solid rgba(147,197,253,.65)',
              ['--rscale' as string]: String(r.scale),
              animation: `lfd-ripple 1.4s ease-out ${r.del}s both`,
            }}
          />
        ))}
      </div>
    </>,
    document.body,
  )
}


/**
 * Generates the PNG home-screen icons into public/ (the app's square brand mark: green tile, "LFD").
 *
 *   node src/scripts/generate-pwa-icons.mjs
 *
 * Uses `sharp`, which ships with Next.js. Icons are full-bleed squares: iOS rounds the corners itself,
 * and the maskable variant keeps the mark inside the centre 80% so Android can crop it to any shape.
 */

import sharp from 'sharp'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

const OUT = join(process.cwd(), 'public')
mkdirSync(OUT, { recursive: true })

/** `scale` shrinks the mark toward the centre (1 = fill the tile). */
function iconSvg(size, scale = 1) {
  const fontSize = size * 0.34 * scale
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#166534"/>
      <stop offset="1" stop-color="#16a34a"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#g)"/>
  <text x="${size / 2}" y="${size / 2 + fontSize * 0.35}" text-anchor="middle"
        font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-weight="800"
        font-size="${fontSize}" letter-spacing="${-fontSize * 0.02}" fill="#ffffff">LFD</text>
</svg>`)
}

const targets = [
  { file: 'apple-touch-icon.png', size: 180, scale: 1 },
  { file: 'icon-192.png', size: 192, scale: 1 },
  { file: 'icon-512.png', size: 512, scale: 1 },
  { file: 'icon-maskable-512.png', size: 512, scale: 0.8 },
]

for (const { file, size, scale } of targets) {
  await sharp(iconSvg(size, scale)).png().toFile(join(OUT, file))
  console.log(`✓ public/${file} (${size}×${size})`)
}

import { CanvasTexture, SRGBColorSpace } from 'three'

/**
 * Crack overlays for diggable floors, from hairline (stage 1) to shattered
 * (stage 4). Each stage redraws the previous stage's cracks and adds more, so
 * the damage visibly spreads rather than jumping to a new pattern.
 */

export const CRACK_STAGES = 4

/** Damage fraction (0..1) -> crack stage 0..4. */
export const crackStage = (damage) =>
  damage <= 0.02 ? 0 : Math.min(CRACK_STAGES, 1 + Math.floor(damage * CRACK_STAGES))

let textures = null

function seeded(seed) {
  let s = seed
  return () => (s = (s * 16807) % 2147483647) / 2147483647
}

/** A jagged crack that wanders from (x, y) and sometimes forks. */
function crack(g, rnd, x, y, angle, length, width, depth = 0) {
  g.lineWidth = width
  g.beginPath()
  g.moveTo(x, y)
  let a = angle
  const segments = 6 + Math.floor(rnd() * 5)
  const step = length / segments
  for (let i = 0; i < segments; i++) {
    a += (rnd() - 0.5) * 0.9
    x += Math.cos(a) * step
    y += Math.sin(a) * step
    g.lineTo(x, y)
    if (depth < 2 && rnd() < 0.3) {
      g.stroke()
      crack(g, rnd, x, y, a + (rnd() < 0.5 ? 1 : -1) * (0.5 + rnd() * 0.6), length * 0.45, width * 0.6, depth + 1)
      g.lineWidth = width
      g.beginPath()
      g.moveTo(x, y)
    }
  }
  g.stroke()
}

export function crackTextures() {
  if (textures) return textures
  const size = 512
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const g = canvas.getContext('2d')
  g.lineCap = 'round'
  g.lineJoin = 'round'
  const rnd = seeded(1234567)

  textures = []
  for (let stage = 1; stage <= CRACK_STAGES; stage++) {
    // Each stage adds cracks from the centre outward plus a few from the edges.
    for (let i = 0; i < 3; i++) {
      const cx = size * (0.35 + rnd() * 0.3)
      const cy = size * (0.35 + rnd() * 0.3)
      g.strokeStyle = 'rgba(25,14,8,0.85)'
      crack(g, rnd, cx, cy, rnd() * Math.PI * 2, size * (0.25 + stage * 0.08), 9 - stage)
    }
    if (stage >= 3) {
      // Chunks starting to break loose: darker patches.
      for (let i = 0; i < stage * 2; i++) {
        g.fillStyle = 'rgba(20,10,5,0.35)'
        g.beginPath()
        const x = rnd() * size
        const y = rnd() * size
        const r = 14 + rnd() * 26
        g.moveTo(x + r, y)
        for (let k = 1; k < 6; k++) {
          const a = (k / 6) * Math.PI * 2
          g.lineTo(x + Math.cos(a) * r * (0.6 + rnd() * 0.5), y + Math.sin(a) * r * (0.6 + rnd() * 0.5))
        }
        g.fill()
      }
    }
    const snapshot = document.createElement('canvas')
    snapshot.width = snapshot.height = size
    snapshot.getContext('2d').drawImage(canvas, 0, 0)
    const tex = new CanvasTexture(snapshot)
    tex.colorSpace = SRGBColorSpace
    tex.anisotropy = 8
    textures.push(tex)
  }
  return textures
}

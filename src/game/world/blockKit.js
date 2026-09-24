import {
  BoxGeometry,
  CanvasTexture,
  Color,
  MeshStandardMaterial,
  RepeatWrapping,
  SRGBColorSpace,
} from 'three'

/**
 * Shared materials, geometry and canvas-text helpers for the blocky world.
 *
 * The Roblox building-block look: every surface is tiled with a square "stud"
 * pattern, in grayscale so one texture tints to any colour via the material.
 */

const TILE = 0.33 // world units per stud tile

function makeCanvas(size, draw) {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  draw(canvas.getContext('2d'), size)
  const tex = new CanvasTexture(canvas)
  tex.wrapS = tex.wrapT = RepeatWrapping
  tex.colorSpace = SRGBColorSpace
  tex.anisotropy = 16
  return tex
}

/**
 * One small bevelled tile with a raised square stud in the middle: a light top-left
 * edge, a shaded bottom-right edge, and a soft drop shadow under the stud.
 */
const studTexture = makeCanvas(256, (g, s) => {
  // Face, with a faint top-to-bottom falloff so large floors don't look flat.
  const face = g.createLinearGradient(0, 0, s, s)
  face.addColorStop(0, '#f4f4f8')
  face.addColorStop(1, '#e2e2ea')
  g.fillStyle = face
  g.fillRect(0, 0, s, s)

  // Bevel around the tile edge.
  const e = s * 0.045
  g.fillStyle = 'rgba(255,255,255,0.9)'
  g.fillRect(0, 0, s, e)
  g.fillRect(0, 0, e, s)
  g.fillStyle = 'rgba(105,105,135,0.7)'
  g.fillRect(0, s - e, s, e)
  g.fillRect(s - e, 0, e, s)
  // Hairline seam between neighbouring tiles.
  g.strokeStyle = 'rgba(90,90,115,0.45)'
  g.lineWidth = 2
  g.strokeRect(1, 1, s - 2, s - 2)

  // Stud: drop shadow, then a rounded square with its own highlight/shade.
  const a = s * 0.27
  const w = s * 0.46
  const r = s * 0.06
  g.fillStyle = 'rgba(60,60,90,0.4)'
  g.beginPath()
  g.roundRect(a + s * 0.03, a + s * 0.04, w, w, r)
  g.fill()

  const stud = g.createLinearGradient(a, a, a + w, a + w)
  stud.addColorStop(0, '#ffffff')
  stud.addColorStop(0.55, '#ededf3')
  stud.addColorStop(1, '#d3d3de')
  g.fillStyle = stud
  g.beginPath()
  g.roundRect(a, a, w, w, r)
  g.fill()
  g.strokeStyle = 'rgba(95,95,130,0.75)'
  g.lineWidth = s * 0.018
  g.stroke()

  // Specular glint on the stud's top-left corner.
  g.strokeStyle = 'rgba(255,255,255,0.95)'
  g.lineWidth = s * 0.02
  g.beginPath()
  g.moveTo(a + r, a + s * 0.025)
  g.lineTo(a + w * 0.7, a + s * 0.025)
  g.moveTo(a + s * 0.025, a + r)
  g.lineTo(a + s * 0.025, a + w * 0.7)
  g.stroke()
})

/** Rough cobble for barriers — reads as "diggable" next to the smooth walls. */
const cobbleTexture = makeCanvas(256, (g, s) => {
  g.fillStyle = '#d8d8d8'
  g.fillRect(0, 0, s, s)
  let seed = 7
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  for (let i = 0; i < 70; i++) {
    const x = rnd() * s
    const y = rnd() * s
    const r = 10 + rnd() * 18
    const shade = 150 + Math.floor(rnd() * 90)
    g.fillStyle = `rgb(${shade},${shade},${shade})`
    g.beginPath()
    g.roundRect(x - r, y - r * 0.8, r * 2, r * 1.6, 6)
    g.fill()
    g.strokeStyle = 'rgba(0,0,0,0.25)'
    g.lineWidth = 3
    g.stroke()
  }
})
// Studs are three per unit; the cobbles read better at one repeat per four units.
cobbleTexture.repeat.set(TILE / 4, TILE / 4)

const materialCache = new Map()

/** One shared material per colour + finish, so hundreds of blocks cost little. */
export function studMaterial(color, { cobble = false, emissive = 0, opacity = 1 } = {}) {
  const key = `${color}|${cobble}|${emissive}|${opacity}`
  let m = materialCache.get(key)
  if (!m) {
    m = new MeshStandardMaterial({
      color: new Color(color),
      map: cobble ? cobbleTexture : studTexture,
      roughness: 0.85,
      metalness: 0,
      emissive: emissive ? new Color(color) : new Color(0),
      emissiveIntensity: emissive,
      transparent: opacity < 1,
      opacity,
      // The environment map is there for shiny loot; on matte blocks it just
      // washes out the stud shading.
      envMapIntensity: 0.25,
    })
    materialCache.set(key, m)
  }
  return m
}

const plainCache = new Map()
export function plainMaterial(color, emissive = 0) {
  const key = `${color}|${emissive}`
  let m = plainCache.get(key)
  if (!m) {
    m = new MeshStandardMaterial({
      color: new Color(color),
      roughness: 0.6,
      emissive: emissive ? new Color(color) : new Color(0),
      emissiveIntensity: emissive,
    })
    plainCache.set(key, m)
  }
  return m
}

const geometryCache = new Map()

/**
 * A box whose UVs are scaled per face by that face's world size, so the stud
 * pattern stays the same size on a 1x1 block and a 100x100 floor.
 */
export function studBox(w, h, d) {
  const key = `${w.toFixed(2)}|${h.toFixed(2)}|${d.toFixed(2)}`
  let geo = geometryCache.get(key)
  if (geo) return geo

  geo = new BoxGeometry(w, h, d)
  const uv = geo.getAttribute('uv')
  // BoxGeometry face order: +x, -x, +y, -y, +z, -z (4 vertices each).
  const faceSize = [
    [d, h],
    [d, h],
    [w, d],
    [w, d],
    [w, h],
    [w, h],
  ]
  for (let face = 0; face < 6; face++) {
    const [fu, fv] = faceSize[face]
    for (let v = 0; v < 4; v++) {
      const i = face * 4 + v
      uv.setXY(i, (uv.getX(i) * fu) / TILE, (uv.getY(i) * fv) / TILE)
    }
  }
  uv.needsUpdate = true
  geometryCache.set(key, geo)
  return geo
}

/* ------------------------------------------------------------------------ */
/* Canvas text, for signs and boards that live in the 3D world              */
/* ------------------------------------------------------------------------ */

export const FONT = '"Fredoka", "Trebuchet MS", system-ui, sans-serif'

/** Draws outlined, chunky game text (white fill, black stroke by default). */
export function drawGameText(g, text, x, y, size, fill = '#ffffff', stroke = '#101018', align = 'center') {
  g.font = `700 ${size}px ${FONT}`
  g.textAlign = align
  g.textBaseline = 'middle'
  g.lineJoin = 'round'
  g.lineWidth = Math.max(4, size * 0.16)
  g.strokeStyle = stroke
  g.strokeText(text, x, y)
  g.fillStyle = fill
  g.fillText(text, x, y)
}

export function rainbowGradient(g, x0, x1) {
  const grad = g.createLinearGradient(x0, 0, x1, 0)
  ;['#ff3b3b', '#ffb400', '#fff200', '#3dff5a', '#3fa9ff', '#c054ff'].forEach((c, i, a) =>
    grad.addColorStop(i / (a.length - 1), c),
  )
  return grad
}

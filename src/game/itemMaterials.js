import {
  AdditiveBlending,
  CanvasTexture,
  Color,
  CylinderGeometry,
  IcosahedronGeometry,
  LatheGeometry,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  SRGBColorSpace,
  Vector2,
} from 'three'

/**
 * Shared geometry and materials for loot models. Everything is cached, so twenty
 * diamonds on a floor share one geometry and one material.
 */

const cache = new Map()
const once = (key, make) => {
  if (!cache.has(key)) cache.set(key, make())
  return cache.get(key)
}

/* ---------------------------------------------------------------- geometry */

/** Brilliant cut: pointed pavilion, girdle, crown facets and a flat table. */
export const diamondGeo = () =>
  once('diamond', () =>
    new LatheGeometry(
      [
        new Vector2(0, -0.46),
        new Vector2(0.44, 0.02),
        new Vector2(0.46, 0.07),
        new Vector2(0.3, 0.24),
        new Vector2(0, 0.24),
      ],
      10,
    ),
  )

/** Hexagonal crystal with a pointed tip, standing on its base. */
export const crystalGeo = () =>
  once('crystal', () =>
    new LatheGeometry(
      [new Vector2(0, 0), new Vector2(0.13, 0), new Vector2(0.13, 0.5), new Vector2(0, 0.74)],
      6,
    ),
  )

/** A lumpy low-poly rock, jittered deterministically so every copy matches. */
export const rockGeo = () =>
  once('rock', () => {
    const g = new IcosahedronGeometry(0.42, 1)
    const p = g.getAttribute('position')
    let seed = 11
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    // Icosahedron vertices are duplicated per face; jitter by position so seams stay shut.
    const offsets = new Map()
    for (let i = 0; i < p.count; i++) {
      const key = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`
      if (!offsets.has(key)) offsets.set(key, 0.82 + rnd() * 0.3)
      const k = offsets.get(key)
      p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 0.78, p.getZ(i) * k)
    }
    g.computeVertexNormals()
    return g
  })

/** A trapezoid ingot (wide base, narrower top). */
export const ingotGeo = () =>
  once('ingot', () => {
    const g = new CylinderGeometry(0.3, 0.42, 0.26, 4, 1)
    g.rotateY(Math.PI / 4)
    g.scale(1.45, 1, 0.75)
    return g
  })

/* --------------------------------------------------------------- materials */

/** Faceted, glossy, slightly see-through gemstone. */
export const gemMat = (color) =>
  once(`gem|${color}`, () =>
    new MeshPhysicalMaterial({
      color: new Color(color),
      metalness: 0.05,
      roughness: 0.03,
      clearcoat: 1,
      clearcoatRoughness: 0.02,
      iridescence: 0.35,
      specularIntensity: 1,
      emissive: new Color(color),
      emissiveIntensity: 0.22,
      flatShading: true,
      transparent: true,
      opacity: 0.9,
      envMapIntensity: 2,
    }),
  )

export const metalMat = (color, glow = 0) =>
  once(`metal|${color}|${glow}`, () =>
    new MeshStandardMaterial({
      color: new Color(color),
      // Not fully metallic: a pure metal shows only reflections, which read as
      // black under this soft environment. A little base colour keeps gold gold.
      metalness: 0.75,
      roughness: 0.28,
      emissive: new Color(color),
      emissiveIntensity: glow + 0.08,
      envMapIntensity: 2.2,
    }),
  )

export const stoneMat = (color, shiny = false) =>
  once(`stone|${color}|${shiny}`, () =>
    new MeshStandardMaterial({
      color: new Color(color),
      roughness: shiny ? 0.25 : 0.92,
      metalness: shiny ? 0.35 : 0,
      flatShading: true,
      envMapIntensity: shiny ? 1.5 : 0.6,
    }),
  )

/** Glossy toy plastic (rubber duck, candy). */
export const plasticMat = (color) =>
  once(`plastic|${color}`, () =>
    new MeshPhysicalMaterial({
      color: new Color(color),
      roughness: 0.28,
      clearcoat: 0.9,
      clearcoatRoughness: 0.15,
      envMapIntensity: 1.2,
    }),
  )

export const matteMat = (color) =>
  once(`matte|${color}`, () => new MeshStandardMaterial({ color: new Color(color), roughness: 0.8 }))

export const glowMat = (color, intensity = 2) =>
  once(`glow|${color}|${intensity}`, () =>
    new MeshStandardMaterial({
      color: new Color(color),
      emissive: new Color(color),
      emissiveIntensity: intensity,
      roughness: 0.4,
    }),
  )

/** Clear glass shell for orbs. */
export const glassMat = (color) =>
  once(`glass|${color}`, () =>
    new MeshPhysicalMaterial({
      color: new Color(color),
      roughness: 0.02,
      metalness: 0,
      clearcoat: 1,
      transparent: true,
      opacity: 0.35,
      envMapIntensity: 2.5,
      depthWrite: false,
    }),
  )

/* ------------------------------------------------------------ decal sprites */

function radialTexture(inner, outer) {
  const s = 128
  const c = document.createElement('canvas')
  c.width = c.height = s
  const g = c.getContext('2d')
  const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2)
  grad.addColorStop(0, inner)
  grad.addColorStop(1, outer)
  g.fillStyle = grad
  g.fillRect(0, 0, s, s)
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  return t
}

/** Soft contact shadow under an item. */
export const shadowTex = () => once('shadowTex', () => radialTexture('rgba(0,0,0,0.45)', 'rgba(0,0,0,0)'))
/** White radial glow, tinted per item and drawn additively. */
export const glowTex = () => once('glowTex', () => radialTexture('rgba(255,255,255,0.9)', 'rgba(255,255,255,0)'))
export { AdditiveBlending }

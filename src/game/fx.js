import { Color } from 'three'

/**
 * Fire-and-forget visual effects. Gameplay code (network handlers, barriers) calls
 * these; <Effects> in the scene drains the queues every frame.
 */

export const MAX_DEBRIS = 320

/** Live debris particles, simulated by <Effects>. */
export const debris = []

/**
 * Burst of rock chips.
 * @param {{x:number,y:number,z:number}} at  where they fly from
 * @param {string} color  base colour (chips vary around it)
 * @param {number} count
 * @param {number} power  launch speed
 */
export function spawnDebris(at, color, count = 8, power = 4, size = 0.18) {
  const base = new Color(color)
  for (let i = 0; i < count; i++) {
    if (debris.length >= MAX_DEBRIS) debris.shift()
    const a = Math.random() * Math.PI * 2
    const up = 0.6 + Math.random() * 0.9
    const c = base.clone().offsetHSL(0, 0, (Math.random() - 0.5) * 0.25)
    debris.push({
      x: at.x + (Math.random() - 0.5) * 0.6,
      y: at.y + 0.1,
      z: at.z + (Math.random() - 0.5) * 0.6,
      vx: Math.cos(a) * power * (0.4 + Math.random() * 0.6),
      vy: power * up,
      vz: Math.sin(a) * power * (0.4 + Math.random() * 0.6),
      floor: at.y,
      life: 0,
      max: 0.8 + Math.random() * 0.6,
      size: size * (0.6 + Math.random() * 0.8),
      spin: Math.random() * 10,
      color: c,
    })
  }
}

/** Loot items currently flying from the ground into someone's backpack. */
export const flights = []
const flightListeners = new Set()
export const onFlightsChange = (fn) => {
  flightListeners.add(fn)
  return () => flightListeners.delete(fn)
}

let flightSeq = 0
/**
 * An item arcs from `from` into a backpack: the local player's, or whoever
 * `target()` points at (it returns that player's centre, or null if they left).
 */
export function spawnFlight(kind, from, onLand, target = null) {
  flights.push({ id: ++flightSeq, kind, from: { ...from }, onLand, target })
  flightListeners.forEach((fn) => fn())
}
export function removeFlight(id) {
  const i = flights.findIndex((f) => f.id === id)
  if (i >= 0) flights.splice(i, 1)
  flightListeners.forEach((fn) => fn())
}

/** Expanding rings on the ground (a training pad pulsing under someone's feet). */
export const MAX_RINGS = 24
export const rings = []
export function spawnRing(at, color, size = 2.4) {
  if (rings.length >= MAX_RINGS) rings.shift()
  rings.push({ x: at.x, y: at.y, z: at.z, color: new Color(color), size, life: 0, max: 0.7 })
}

/** Floating text in the world ("+120 💪" over another player), drawn by <Effects>. */
export const MAX_POPS = 16
export const pops = []
const popListeners = new Set()
export const onPopsChange = (fn) => {
  popListeners.add(fn)
  return () => popListeners.delete(fn)
}
let popSeq = 0
export function spawnPop(at, text, color = '#ffe14d') {
  if (pops.length >= MAX_POPS) pops.shift()
  const id = ++popSeq
  pops.push({ id, x: at.x + (Math.random() - 0.5) * 0.6, y: at.y, z: at.z + (Math.random() - 0.5) * 0.6, text, color })
  popListeners.forEach((fn) => fn())
  setTimeout(() => {
    const i = pops.findIndex((p) => p.id === id)
    if (i >= 0) pops.splice(i, 1)
    popListeners.forEach((fn) => fn())
  }, 900)
}

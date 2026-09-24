import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useRef, useState } from 'react'
import { AdditiveBlending, Object3D } from 'three'

import { ITEMS_BY_ID } from '../shared/gameConfig'
import {
  debris,
  flights,
  MAX_DEBRIS,
  MAX_RINGS,
  onFlightsChange,
  onPopsChange,
  pops,
  removeFlight,
  rings,
} from './fx'
import { ItemModel } from './ItemModels'
import { localPlayer } from './localPlayer'
import { studBox, studMaterial } from './world/blockKit'

const GRAVITY = 20
const FLIGHT_TIME = 0.55
const _o = new Object3D()

/** All rock chips in one instanced mesh: hundreds of particles, one draw call. */
function Debris() {
  const ref = useRef()
  useFrame((_st, dt) => {
    const mesh = ref.current
    if (!mesh) return
    const step = Math.min(dt, 0.05)
    for (let i = debris.length - 1; i >= 0; i--) {
      const p = debris[i]
      p.life += step
      if (p.life >= p.max) {
        debris.splice(i, 1)
        continue
      }
      p.vy -= GRAVITY * step
      p.x += p.vx * step
      p.y += p.vy * step
      p.z += p.vz * step
      // Bounce once or twice on the surface they came from, then settle.
      if (p.y < p.floor) {
        p.y = p.floor
        p.vy *= -0.35
        p.vx *= 0.6
        p.vz *= 0.6
      }
      p.spin += step * 8
    }
    for (let i = 0; i < MAX_DEBRIS; i++) {
      const p = debris[i]
      if (p) {
        const fade = 1 - Math.pow(p.life / p.max, 3)
        _o.position.set(p.x, p.y + p.size / 2, p.z)
        _o.rotation.set(p.spin, p.spin * 0.7, 0)
        _o.scale.setScalar(p.size * fade)
        _o.updateMatrix()
        mesh.setMatrixAt(i, _o.matrix)
        mesh.setColorAt(i, p.color)
      } else {
        _o.scale.setScalar(0)
        _o.updateMatrix()
        mesh.setMatrixAt(i, _o.matrix)
      }
    }
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  })
  return (
    <instancedMesh
      ref={ref}
      args={[studBox(1, 1, 1), studMaterial('#ffffff'), MAX_DEBRIS]}
      castShadow
      frustumCulled={false}
    />
  )
}

/** One item arcing from the floor into the backpack, shrinking as it goes. */
function Flight({ f }) {
  const ref = useRef()
  const progress = useRef(0)
  const def = ITEMS_BY_ID[f.kind]
  useFrame((_st, dt) => {
    const g = ref.current
    if (!g) return
    progress.current += dt / FLIGHT_TIME
    const t = Math.min(1, progress.current)
    // Aim at the backpack: behind and a little above the player's centre.
    const to = (f.target && f.target()) || localPlayer.pos
    const ease = t * t * (3 - 2 * t)
    g.position.set(
      f.from.x + (to.x - f.from.x) * ease,
      f.from.y + (to.y + 0.4 - f.from.y) * ease + Math.sin(t * Math.PI) * 2.2,
      f.from.z + (to.z - f.from.z) * ease,
    )
    g.rotation.y += dt * 10
    g.scale.setScalar(1 - 0.75 * ease)
    if (t >= 1) {
      f.onLand?.()
      removeFlight(f.id)
    }
  })
  if (!def) return null
  return (
    <group ref={ref} position={[f.from.x, f.from.y, f.from.z]}>
      <ItemModel def={def} sparkles={false} />
    </group>
  )
}

/** Pad pulses: flat rings that grow and fade. A small pool of meshes, reused. */
function Rings() {
  const refs = useRef([])
  useFrame((_st, dt) => {
    for (let i = rings.length - 1; i >= 0; i--) {
      rings[i].life += dt
      if (rings[i].life >= rings[i].max) rings.splice(i, 1)
    }
    for (let i = 0; i < MAX_RINGS; i++) {
      const m = refs.current[i]
      if (!m) continue
      const r = rings[i]
      m.visible = Boolean(r)
      if (!r) continue
      const t = r.life / r.max
      m.position.set(r.x, r.y + 0.08, r.z)
      m.scale.setScalar(r.size * (0.3 + t))
      m.material.color.copy(r.color)
      m.material.opacity = 0.8 * (1 - t)
    }
  })
  return Array.from({ length: MAX_RINGS }, (_, i) => (
    <mesh key={i} ref={(m) => (refs.current[i] = m)} rotation-x={-Math.PI / 2} visible={false}>
      <ringGeometry args={[0.8, 1, 32]} />
      <meshBasicMaterial transparent depthWrite={false} blending={AdditiveBlending} />
    </mesh>
  ))
}

/** Floating numbers over other players. */
function Pops() {
  const [, setTick] = useState(0)
  useEffect(() => onPopsChange(() => setTick((n) => n + 1)), [])
  return pops.map((p) => (
    <Html key={p.id} position={[p.x, p.y, p.z]} center distanceFactor={9} zIndexRange={[5, 0]}>
      <div className="act-pop" style={{ color: p.color }}>
        {p.text}
      </div>
    </Html>
  ))
}

export function Effects() {
  const [, setTick] = useState(0)
  useEffect(() => onFlightsChange(() => setTick((n) => n + 1)), [])
  return (
    <>
      <Debris />
      <Rings />
      <Pops />
      {flights.map((f) => (
        <Flight key={f.id} f={f} />
      ))}
    </>
  )
}

export default Effects

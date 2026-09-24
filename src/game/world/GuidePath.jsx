import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { DoubleSide, Object3D, Shape, ShapeGeometry } from 'three'

import { guideTarget } from '../guide'
import { localPlayer } from '../localPlayer'

const MAX_CHEVRONS = 40
const SPACING = 2.4
/** Size of each ground chevron, and of the arrow over the target. */
const CHEVRON_SCALE = 1.9
const MARKER_SCALE = 1.7
/** Server/physics positions are the capsule centre; feet are this far below. */
const HALF_HEIGHT = 0.9
const COLOR = '#ffe14d'
/** Ground chevrons: a deeper yellow, so they stand out on the pale lobby tiles. */
const TRAIL_COLOR = '#ffb400'
const _o = new Object3D()

/** Flat ">" chevron pointing along +Z, lying on the ground. */
function chevronGeometry() {
  const s = new Shape()
  s.moveTo(-0.6, -0.45)
  s.lineTo(0, 0.15)
  s.lineTo(0.6, -0.45)
  s.lineTo(0.6, 0.05)
  s.lineTo(0, 0.65)
  s.lineTo(-0.6, 0.05)
  s.closePath()
  const g = new ShapeGeometry(s)
  // Shape is in XY; lay it flat so its "up" (+Y) points along +Z.
  g.rotateX(Math.PI / 2)
  g.scale(CHEVRON_SCALE, 1, CHEVRON_SCALE)
  return g
}

/**
 * The guide's arrows: a trail of glowing chevrons marching along the ground from
 * the player to the target, and a big bouncing arrow over the target itself.
 */
export function GuidePath() {
  const chevrons = useRef()
  const marker = useRef()
  const ring = useRef()
  const geometry = useMemo(() => chevronGeometry(), [])

  useFrame((st) => {
    const t = st.clock.elapsedTime
    const g = guideTarget
    const p = localPlayer.pos
    const feetY = p.y - HALF_HEIGHT

    if (marker.current) {
      marker.current.visible = g.on
      marker.current.position.set(g.x, g.y + 4.2 + Math.sin(t * 4) * 0.45, g.z)
      marker.current.rotation.y = t * 2
    }
    if (ring.current) {
      ring.current.visible = g.on
      ring.current.position.set(g.x, g.y + 0.08, g.z)
      const k = (t * 1.2) % 1
      ring.current.scale.setScalar(1 + k * 1.5)
      ring.current.material.opacity = 0.9 * (1 - k)
    }

    const mesh = chevrons.current
    if (!mesh) return
    const dx = g.x - p.x
    const dz = g.z - p.z
    const dist = Math.hypot(dx, dz)
    // Only on the same level: a trail through floors and walls just confuses.
    const show = g.on && g.path && Math.abs(g.y - feetY) < 3 && dist > 2.5
    const count = show ? Math.min(MAX_CHEVRONS, Math.floor((dist - 2) / SPACING)) : 0
    const angle = Math.atan2(dx, dz)
    const shift = (t * 3) % SPACING
    for (let i = 0; i < MAX_CHEVRONS; i++) {
      if (i < count) {
        const d = 1.6 + i * SPACING + shift
        const f = d / dist
        _o.position.set(p.x + dx * f, feetY + 0.07 + (g.y - feetY) * f, p.z + dz * f)
        _o.rotation.set(0, angle, 0)
        // Fade in near the player, pulse along the trail.
        const s = Math.min(1, d / 3) * (0.85 + 0.15 * Math.sin(t * 6 - i * 0.7))
        _o.scale.setScalar(s)
      } else {
        _o.scale.setScalar(0)
      }
      _o.updateMatrix()
      mesh.setMatrixAt(i, _o.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
  })

  return (
    <>
      <instancedMesh ref={chevrons} args={[geometry, undefined, MAX_CHEVRONS]} frustumCulled={false}>
        <meshBasicMaterial color={TRAIL_COLOR} side={DoubleSide} transparent opacity={0.95} depthWrite={false} />
      </instancedMesh>
      {/* Big arrow bobbing over the target, pointing down at it */}
      <group ref={marker} visible={false} scale={MARKER_SCALE}>
        <mesh position={[0, 0.9, 0]}>
          <cylinderGeometry args={[0.28, 0.28, 1.4, 12]} />
          <meshStandardMaterial color={COLOR} emissive={COLOR} emissiveIntensity={0.6} />
        </mesh>
        <mesh rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.7, 1, 16]} />
          <meshStandardMaterial color={COLOR} emissive={COLOR} emissiveIntensity={0.6} />
        </mesh>
      </group>
      <mesh ref={ring} rotation-x={-Math.PI / 2} visible={false}>
        <ringGeometry args={[1.8, 2.4, 48]} />
        <meshBasicMaterial color={COLOR} transparent depthWrite={false} />
      </mesh>
    </>
  )
}

export default GuidePath

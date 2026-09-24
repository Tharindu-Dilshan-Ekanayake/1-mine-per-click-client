import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { forwardRef, Suspense, useCallback, useRef } from 'react'
import { Vector3 } from 'three'

import { AURA_BY_ID, PICKAXE_BY_ID, PICKAXES } from '../shared/gameConfig'
import { Backpack } from './Backpack'
import { AvatarBoundary, BlockyAvatar } from './BlockyAvatar'
import PlayerAvatar from './PlayerAvatar'
import { Block } from './world/blocks'

/** Seconds for one full pickaxe swing (wind-up, strike, recover). */
export const SWING_DURATION = 0.26
const ARM_REST = -0.45
const ARM_WINDUP = -2.7
const ARM_STRIKE = -0.2
/** Shoulder-to-fist distance for a ~1.8 unit tall avatar. */
const ARM_LENGTH = 0.62

const smooth = (t) => t * t * (3 - 2 * t)

/** Arm angle for a swing that started `t` seconds ago (null = not swinging). */
function swingAngle(t) {
  if (t === null || t < 0 || t >= SWING_DURATION) return ARM_REST
  const p = t / SWING_DURATION
  if (p < 0.4) return ARM_REST + (ARM_WINDUP - ARM_REST) * smooth(p / 0.4)
  if (p < 0.65) return ARM_WINDUP + (ARM_STRIKE - ARM_WINDUP) * smooth((p - 0.4) / 0.25)
  return ARM_STRIKE + (ARM_REST - ARM_STRIKE) * smooth((p - 0.65) / 0.35)
}

/**
 * A blocky pickaxe in its holder's hand. The local frame is the arm: the fist is at
 * (0, -ARM_LENGTH, 0) and the handle sticks out along +Z from it.
 */
export function Pickaxe({ id }) {
  const def = PICKAXE_BY_ID[id] || PICKAXES[0]
  const y = -ARM_LENGTH
  const glow = ['Legendary', 'Mythic', 'Divine'].includes(def.rarity) ? 0.6 : 0
  return (
    <group>
      <Block plain pos={[0, y, 0.3]} size={[0.09, 0.09, 1.1]} color={def.handle} />
      {/* Head: a centre block plus two blades curving back toward the hand */}
      <Block plain pos={[0, y, 0.84]} size={[0.16, 0.2, 0.2]} color={def.head} emissive={glow} />
      <Block plain pos={[0, y + 0.3, 0.8]} size={[0.13, 0.45, 0.15]} color={def.head} rot={[0.25, 0, 0]} emissive={glow} />
      <Block plain pos={[0, y - 0.3, 0.8]} size={[0.13, 0.45, 0.15]} color={def.head} rot={[-0.25, 0, 0]} emissive={glow} />
      <Block plain pos={[0, y + 0.55, 0.7]} size={[0.1, 0.16, 0.12]} color={def.head} rot={[0.5, 0, 0]} emissive={glow} />
      <Block plain pos={[0, y - 0.55, 0.7]} size={[0.1, 0.16, 0.12]} color={def.head} rot={[-0.5, 0, 0]} emissive={glow} />
    </group>
  )
}

/** Orbiting glowing cubes around the feet, coloured by aura. */
function Aura({ id }) {
  const ref = useRef()
  const aura = AURA_BY_ID[id]
  useFrame((st) => {
    if (!ref.current) return
    const t = st.clock.elapsedTime
    ref.current.rotation.y = t * 2
    ref.current.children.forEach((c, i) => {
      c.position.y = 0.2 + ((t * 0.8 + i * 0.37) % 1) * 2
      c.scale.setScalar(1 - ((t * 0.8 + i * 0.37) % 1) * 0.7)
    })
  })
  if (!aura || aura.id === 'none') return null
  return (
    <group>
      <group ref={ref}>
        {Array.from({ length: 8 }, (_, i) => {
          const a = (i / 8) * Math.PI * 2
          return (
            <mesh key={i} position={[Math.cos(a) * 0.8, 0, Math.sin(a) * 0.8]}>
              <boxGeometry args={[0.18, 0.18, 0.18]} />
              <meshBasicMaterial color={aura.color} />
            </mesh>
          )
        })}
      </group>
      <mesh position={[0, 1, 0]}>
        <cylinderGeometry args={[0.9, 0.9, 2.2, 12, 1, true]} />
        <meshBasicMaterial color={aura.color} transparent opacity={0.16} depthWrite={false} />
      </mesh>
    </group>
  )
}

const _shoulder = new Vector3()
const _spine = new Vector3()

/**
 * Everything drawn for one player, local or remote. The parent positions the
 * group with the feet at y = 0 and the avatar facing +Z.
 *
 * `motionRef.current.swingT` (seconds since the last swing started, or null) drives
 * the arm; Character writes `armAngle` back for the avatar rig to pose.
 */
export const Character = forwardRef(function Character(
  {
    motionRef,
    height,
    pickaxe = 'wood',
    aura = 'none',
    name,
    bag,
    equipped,
    proportions,
    reportLoading = false,
    onReady,
  },
  ref,
) {
  const rootRef = useRef()
  const pivotRef = useRef()
  const bagRef = useRef()
  const rigRef = useRef(null)
  const onRig = useCallback((rig) => (rigRef.current = rig), [])
  // While the SDK avatar downloads, a stand-in body (the loading screen keeps
  // waiting for the real one); if the download fails, the stand-in stays.
  const loadingBody = <BlockyAvatar height={height} motionRef={motionRef} />
  const failedBody = <BlockyAvatar height={height} motionRef={motionRef} onReady={onReady} />

  useFrame((_st, delta) => {
    const motion = motionRef.current
    if (motion.swingT !== null && motion.swingT !== undefined) {
      motion.swingT += delta
      if (motion.swingT > SWING_DURATION) motion.swingT = null
    }
    const angle = swingAngle(motion.swingT ?? null)
    motion.armAngle = angle

    const pivot = pivotRef.current
    if (!pivot) return
    pivot.rotation.x = angle

    // Hang the pickaxe off the real shoulder bone, so it stays on the correct
    // side whatever the avatar's proportions are.
    const shoulder = rigRef.current?.bones?.ArmR1?.bone
    if (shoulder && rootRef.current) {
      shoulder.getWorldPosition(_shoulder)
      rootRef.current.worldToLocal(_shoulder)
      pivot.position.copy(_shoulder)
    } else {
      // Blocky stand-in's right shoulder (see BlockyAvatar).
      pivot.position.set(-(height / 5) * 1.5, (height / 5) * 3.9, 0)
    }

    // The backpack rides on the upper spine, just behind the torso.
    const bagGroup = bagRef.current
    if (bagGroup) {
      const spine = rigRef.current?.bones?.Spine2?.bone
      if (spine && rootRef.current) {
        spine.getWorldPosition(_spine)
        rootRef.current.worldToLocal(_spine)
        bagGroup.position.set(_spine.x, _spine.y - 0.02, _spine.z - height * 0.1)
      } else {
        bagGroup.position.set(0, (height / 5) * 3, -(height / 5) * 0.5)
      }
    }
  })

  return (
    <group ref={ref}>
      <group ref={rootRef}>
        {/* The Bloxity avatar comes from a CDN that can take many seconds (or fail).
            Until it's here - or if it never arrives - show a blocky stand-in body,
            so the player is never an invisible floating pickaxe. */}
        <AvatarBoundary fallback={failedBody}>
          <Suspense fallback={loadingBody}>
            <PlayerAvatar
              onReady={onReady}
              targetHeight={height}
              motionRef={motionRef}
              equipped={equipped}
              proportions={proportions}
              reportLoading={reportLoading}
              onRig={onRig}
            />
          </Suspense>
        </AvatarBoundary>
        <group ref={pivotRef}>
          <Pickaxe id={pickaxe} />
        </group>
        {bag && (
          <group ref={bagRef}>
            <Backpack type={bag.type} colors={bag.colors} cap={bag.cap} />
          </group>
        )}
        <Aura id={aura} />
      </group>
      {name !== undefined && (
        <Html position={[0, height + 0.75, 0]} center distanceFactor={7} zIndexRange={[6, 0]}>
          {/* Just the name - strength/level is on the HUD, not floating over every head. */}
          <div className="name-tag">
            <div className="name-tag-name">{name}</div>
          </div>
        </Html>
      )}
    </group>
  )
})

export default Character

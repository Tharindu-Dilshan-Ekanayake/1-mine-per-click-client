import { useFrame } from '@react-three/fiber'
import { Component, useEffect, useRef } from 'react'

import { Block } from './world/blocks'

const SKIN = '#f5cd30'
const SHIRT = '#0d69ac'
const PANTS = '#a4bd47'

/**
 * Classic blocky Roblox-style body, shown while the Bloxity avatar downloads (its
 * CDN can take many seconds) or if it fails to load, so a player is never just a
 * floating pickaxe. Proportions follow the R6 rig: legs 2, torso 2, head 1.
 * Faces +Z with its feet at y = 0, like the real avatar.
 */
export function BlockyAvatar({ height = 1.8, motionRef, onReady }) {
  const u = height / 5
  const legL = useRef()
  const legR = useRef()
  const armL = useRef()
  const armR = useRef()
  const body = useRef()

  // Shown in place of a failed avatar: nothing more to wait for.
  useEffect(() => {
    onReady?.()
  }, [onReady])

  useFrame(() => {
    const m = motionRef?.current
    if (!m || !legL.current) return
    if (m.dance) {
      // Same victory dance as the real avatar (see avatarRig poseDance).
      const t = m.time || 0
      const beat = t * Math.PI * 2 * 1.1
      const side = Math.sin(beat / 2)
      const wave = Math.floor(t / 3.5) % 2 === 1
      body.current.position.y = Math.abs(Math.sin(beat)) * 0.22
      body.current.rotation.z = side * 0.12
      legL.current.rotation.x = -0.5 * Math.max(0, side)
      legR.current.rotation.x = -0.5 * Math.max(0, -side)
      armL.current.rotation.x = wave ? Math.PI : -1.4 - 1.4 * Math.max(0, Math.sin(beat))
      armR.current.rotation.x = wave ? Math.PI : -1.4 - 1.4 * Math.max(0, -Math.sin(beat))
      armL.current.rotation.z = wave ? side * 0.4 : 0
      armR.current.rotation.z = wave ? side * 0.4 : 0
      return
    }
    body.current.rotation.z = 0
    armL.current.rotation.z = 0
    armR.current.rotation.z = 0
    const ratio = Math.min((m.speed || 0) / Math.max(m.maxSpeed || 6, 0.001), 1)
    const phase = (m.time || 0) * (6 + ratio * 5)
    const swingAmt = m.grounded === false ? 0.6 : Math.sin(phase) * 0.9 * ratio
    legL.current.rotation.x = swingAmt
    legR.current.rotation.x = -swingAmt
    armL.current.rotation.x = m.grounded === false ? -2.2 : -swingAmt * 0.8
    // The right arm holds the pickaxe and follows the swing.
    armR.current.rotation.x = m.armAngle ?? swingAmt * 0.8
    body.current.position.y = ratio > 0.05 ? Math.abs(Math.cos(phase)) * 0.06 * ratio : 0
  })

  return (
    <group ref={body}>
      {/* Legs pivot at the hip */}
      <group ref={legL} position={[u * 0.5, u * 2, 0]}>
        <Block plain pos={[0, -u, 0]} size={[u * 0.98, u * 2, u * 0.98]} color={PANTS} />
      </group>
      <group ref={legR} position={[-u * 0.5, u * 2, 0]}>
        <Block plain pos={[0, -u, 0]} size={[u * 0.98, u * 2, u * 0.98]} color={PANTS} />
      </group>
      <Block plain pos={[0, u * 3, 0]} size={[u * 2, u * 2, u]} color={SHIRT} />
      {/* Arms pivot at the shoulder */}
      <group ref={armL} position={[u * 1.5, u * 3.9, 0]}>
        <Block plain pos={[0, -u * 0.9, 0]} size={[u * 0.98, u * 2, u * 0.98]} color={SKIN} />
      </group>
      <group ref={armR} position={[-u * 1.5, u * 3.9, 0]}>
        <Block plain pos={[0, -u * 0.9, 0]} size={[u * 0.98, u * 2, u * 0.98]} color={SKIN} />
      </group>
      <Block plain pos={[0, u * 4.5, 0]} size={[u * 1.2, u, u * 1.2]} color={SKIN} />
      {/* Smiley face on the front (+Z) */}
      <Block plain pos={[-u * 0.25, u * 4.62, u * 0.61]} size={[u * 0.14, u * 0.2, u * 0.02]} color="#111111" shadow={false} />
      <Block plain pos={[u * 0.25, u * 4.62, u * 0.61]} size={[u * 0.14, u * 0.2, u * 0.02]} color="#111111" shadow={false} />
      <Block plain pos={[0, u * 4.3, u * 0.61]} size={[u * 0.5, u * 0.08, u * 0.02]} color="#111111" shadow={false} />
    </group>
  )
}

/**
 * Keeps a failed avatar download (network error, 404) from taking the whole 3D
 * scene down with it: shows `fallback` instead of the avatar.
 */
export class AvatarBoundary extends Component {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error) {
    console.warn('[avatar] failed to load, using the blocky stand-in', error)
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

export default BlockyAvatar

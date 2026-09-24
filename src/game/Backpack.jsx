import { useFrame } from '@react-three/fiber'
import { useEffect, useRef } from 'react'

import { BAG_BY_ID, BAGS } from '../shared/gameConfig'
import { Block } from './world/blocks'

/**
 * The backpack a player wears. Its origin is where it touches the back; it hangs
 * behind (-Z, since characters face +Z). Loot stays inside: as the pack fills it
 * bulges, and the buckle glows when it's full, so you can see it at a glance.
 *
 * @param {{ type: string, colors: string[], cap: number }} props
 *   `colors` are the colours of the items inside, oldest first.
 */
export function Backpack({ type = 'starter', colors = [], cap = 3 }) {
  const bag = BAG_BY_ID[type] || BAGS[0]
  const fill = Math.min(1, colors.length / Math.max(1, cap))
  const bulge = useRef()
  const lastCount = useRef(colors.length)
  const squash = useRef(0)

  // A little squash-and-stretch whenever something lands in the bag.
  useEffect(() => {
    if (colors.length > lastCount.current) squash.current = 1
    lastCount.current = colors.length
  }, [colors.length])
  useFrame((_st, dt) => {
    if (!bulge.current) return
    squash.current = Math.max(0, squash.current - dt * 4)
    const s = squash.current
    const f = 1 + fill * 0.18
    bulge.current.scale.set(f * (1 + s * 0.12), 1 + s * 0.1, f * (1 + s * 0.2))
  })

  const g = bag.glow || 0
  const full = colors.length >= cap
  const w = 0.56
  const h = 0.62
  const d = 0.26

  return (
    <group position={[0, 0, -d / 2 - 0.02]}>
      <group ref={bulge}>
        {/* Main body + rounded-ish edges */}
        <Block plain pos={[0, 0, 0]} size={[w, h, d]} color={bag.body} emissive={g * 0.3} />
        <Block plain pos={[0, h / 2 + 0.03, 0]} size={[w * 0.9, 0.06, d * 0.9]} color={bag.body} emissive={g * 0.3} />
        {/* Top flap, buckled shut over the loot */}
        <Block plain pos={[0, h / 2 + 0.07, -d * 0.05]} size={[w * 1.04, 0.08, d * 1.08]} color={bag.trim} emissive={g * 0.5} />
        <Block plain pos={[0, h / 2 - 0.02, -d / 2 - 0.06]} size={[w * 0.5, 0.18, 0.06]} color={bag.trim} emissive={g * 0.5} />
        {/* Front pocket + buckle */}
        <Block plain pos={[0, -h * 0.18, -d / 2 - 0.05]} size={[w * 0.75, h * 0.42, 0.1]} color={bag.trim} emissive={g * 0.5} />
        <Block plain pos={[0, -h * 0.02, -d / 2 - 0.105]} size={[0.1, 0.08, 0.02]} color={full ? '#ff4d4d' : bag.accent} emissive={full ? 1 : g + 0.2} />
        {/* Side pockets */}
        {[-1, 1].map((s) => (
          <Block plain key={s} pos={[s * (w / 2 + 0.04), -h * 0.12, 0]} size={[0.08, h * 0.45, d * 0.8]} color={bag.trim} />
        ))}
      </group>
      {/* Shoulder straps running from the top of the pack forward over the shoulders */}
      {[-1, 1].map((s) => (
        <Block plain key={s} pos={[s * 0.17, h / 2 - 0.02, d / 2 + 0.12]} size={[0.07, 0.05, 0.3]} color={bag.trim} shadow={false} />
      ))}
    </group>
  )
}

export default Backpack

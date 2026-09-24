import { useFrame } from '@react-three/fiber'
import { Suspense, useRef } from 'react'

import { STALLS } from '../../shared/gameConfig'
import { AvatarBoundary } from '../BlockyAvatar'
import PlayerAvatar from '../PlayerAvatar'
import { drawGameText } from './blockKit'
import { Block, Solid } from './blocks'
import { CanvasSign } from './CanvasSign'

const WOOD = '#e0782c'
const WOOD_DARK = '#b85a1c'

/** Shopkeeper height: a head taller than players, so they read from afar. */
const NPC_HEIGHT = 2.9

/**
 * The shopkeeper: the same SDK character body as the players (no cosmetics),
 * idling behind the counter. The simple blocky one stands in while it loads.
 */
function Shopkeeper(props) {
  const motion = useRef({ time: (props.position?.[0] ?? 0) + (props.shirt?.length ?? 0), speed: 0, grounded: true, maxSpeed: 6 })
  useFrame((_st, dt) => {
    motion.current.time += dt
  })
  const standIn = <Npc {...props} />
  return (
    <AvatarBoundary fallback={standIn}>
      <Suspense fallback={standIn}>
        <group position={props.position}>
          <PlayerAvatar targetHeight={NPC_HEIGHT} motionRef={motion} equipped={null} reportLoading={false} />
        </group>
      </Suspense>
    </AvatarBoundary>
  )
}

/** A simple blocky shopkeeper, used while the SDK body loads. */
export function Npc({ shirt = '#222', pants = '#2f4f6f', skin = '#f3c9a0', hair = '#6b3d1f', ...props }) {
  return (
    <group {...props}>
      <Block plain pos={[0, 0.55, 0]} size={[0.8, 1.1, 0.45]} color={pants} />
      <Block plain pos={[0, 1.65, 0]} size={[1.0, 1.1, 0.5]} color={shirt} />
      <Block plain pos={[-0.72, 1.6, 0.1]} size={[0.42, 1.0, 0.42]} color={skin} rot={[-0.4, 0, 0]} />
      <Block plain pos={[0.72, 1.6, 0.1]} size={[0.42, 1.0, 0.42]} color={skin} rot={[-0.4, 0, 0]} />
      <Block plain pos={[0, 2.55, 0]} size={[0.72, 0.72, 0.72]} color={skin} />
      <Block plain pos={[0, 2.95, -0.05]} size={[0.8, 0.22, 0.8]} color={hair} />
      <Block plain pos={[-0.16, 2.6, 0.37]} size={[0.1, 0.12, 0.02]} color="#111" shadow={false} />
      <Block plain pos={[0.16, 2.6, 0.37]} size={[0.1, 0.12, 0.02]} color="#111" shadow={false} />
    </group>
  )
}

/** Market stall: wooden frame, striped awning, counter, NPC, floating sign. */
export function Stall({ label, icon, awning, x, z, rotY = 0, npc = {} }) {
  const stripes = 6
  return (
    <group position={[x, 0, z]} rotation={[0, rotY, 0]}>
      <Solid>
        {/* Counter */}
        <Block pos={[0, 0.7, 1.4]} size={[6, 1.4, 1]} color={WOOD} />
        <Block pos={[0, 1.5, 1.4]} size={[6.4, 0.2, 1.3]} color={WOOD_DARK} />
        {/* Back + posts */}
        <Block pos={[0, 1.2, -1.6]} size={[6, 2.4, 0.4]} color={WOOD} />
        {[-2.9, 2.9].flatMap((px) =>
          [-1.6, 1.6].map((pz) => (
            <Block key={`${px}${pz}`} pos={[px, 2, pz]} size={[0.4, 4, 0.4]} color={WOOD_DARK} />
          )),
        )}
      </Solid>

      {/* Striped awning */}
      {Array.from({ length: stripes }, (_, i) => (
        <Block
          key={i}
          pos={[-3 + (i + 0.5) * (6.6 / stripes) - 0.3, 4.2, 0]}
          size={[6.6 / stripes, 0.35, 4.2]}
          color={i % 2 ? '#ffffff' : awning}
          rot={[0.18, 0, 0]}
        />
      ))}
      <Block pos={[0, 3.95, 2.15]} size={[6.8, 0.5, 0.2]} color={awning} />

      <Shopkeeper position={[0, 0, -0.4]} {...npc} />

      <CanvasSign
        position={[0, 6.1, 0.4]}
        size={[7, 1.5]}
        deps={[label, icon]}
        draw={(g, w, h) => drawGameText(g, `${icon} ${label}`, w / 2, h / 2, h * 0.52)}
      />
    </group>
  )
}

const NPC_LOOKS = {
  sell: { shirt: '#1f1f28', hair: '#6b3d1f' },
  upgrades: { shirt: '#c0392b', hair: '#3a2410' },
  pickaxes: { shirt: '#f39c12', hair: '#2b1b0e' },
  auras: { shirt: '#3b82f6', hair: '#b86a2b', skin: '#e8b48a' },
}

export function Stalls() {
  return STALLS.map((s) => <Stall key={s.id} {...s} npc={NPC_LOOKS[s.id]} />)
}

export default Stalls

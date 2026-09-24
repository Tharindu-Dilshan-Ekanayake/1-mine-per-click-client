import { Html, Sparkles } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { Suspense, useMemo, useRef } from 'react'

import { useGame } from '../../net/gameStore'
import { CHAMPIONS, fmt } from '../../shared/gameConfig'
import { AvatarBoundary, BlockyAvatar } from '../BlockyAvatar'
import PlayerAvatar from '../PlayerAvatar'
import { TIERS, useQuality } from '../quality'
import { drawGameText } from './blockKit'
import { Block, Solid } from './blocks'
import { CanvasSign } from './CanvasSign'

const RED = '#e8283c'
const BOARD = '#8a4a1f'

const DANCER_HEIGHT = 2.2

function parseAvatar(json) {
  if (!json) return null
  try {
    return JSON.parse(json)
  } catch {
    return null
  }
}

/**
 * The #1 player of a leaderboard, dancing on their pedestal with their name and
 * a spinning crown overhead. Uses their real avatar when it loads, the blocky
 * body until then.
 */
function Dancer({ champ, title, color, offset = 0, ...props }) {
  const motion = useRef({ time: offset, speed: 0, grounded: true, maxSpeed: 6, dance: true })
  useFrame((_st, dt) => {
    motion.current.time += dt
  })
  const equipped = useMemo(() => parseAvatar(champ?.avatar), [champ?.avatar])
  const blocky = <BlockyAvatar height={DANCER_HEIGHT} motionRef={motion} />
  const effects = useQuality((s) => TIERS[s.tier].effects)
  return (
    <group {...props}>
      <Solid>
        <Block pos={[0, 0.4, 0]} size={[2.4, 0.8, 2.4]} color="#ffc81e" emissive={0.15} />
      </Solid>
      <Block pos={[0, 0.83, 0]} size={[2, 0.06, 2]} color={color} emissive={0.5} shadow={false} />
      {effects && <Sparkles count={18} scale={[2.4, 3, 2.4]} position={[0, 2.2, 0]} size={3} speed={0.5} color={color} />}
      {champ && (
        <group position={[0, 0.86, 0]}>
          {/* key: a new champion gets a fresh avatar (and a fresh error boundary) */}
          <AvatarBoundary key={champ.avatar} fallback={blocky}>
            <Suspense fallback={blocky}>
              <PlayerAvatar
                targetHeight={DANCER_HEIGHT}
                motionRef={motion}
                equipped={equipped}
                reportLoading={false}
              />
            </Suspense>
          </AvatarBoundary>
        </group>
      )}
      <Crown position={[0, DANCER_HEIGHT + 1.6, 0]} scale={0.45} />
      <Html position={[0, DANCER_HEIGHT + 2.5, 0]} center distanceFactor={14} zIndexRange={[4, 0]}>
        <div className="champ-tag">
          <span className="champ-name">{champ ? champ.name : '???'}</span>
          <span className="champ-title">{title}</span>
        </div>
      </Html>
    </group>
  )
}

function Crown({ ...props }) {
  const ref = useRef()
  useFrame((st) => {
    if (ref.current) ref.current.rotation.y = st.clock.elapsedTime * 0.8
  })
  const gold = '#ffc81e'
  return (
    <group ref={ref} {...props}>
      <Block pos={[0, 0, 0]} size={[1.6, 0.5, 1.6]} color={gold} emissive={0.25} />
      {[
        [-0.6, -0.6],
        [0.6, -0.6],
        [-0.6, 0.6],
        [0.6, 0.6],
      ].map(([x, z], i) => (
        <Block key={i} pos={[x, 0.55, z]} size={[0.4, 0.7, 0.4]} color={gold} emissive={0.25} />
      ))}
      <Block pos={[0, 0.2, 0.82]} size={[0.35, 0.35, 0.05]} color="#ff2d55" emissive={0.6} />
    </group>
  )
}

/** A wooden leaderboard, drawn to a canvas so it stays crisp and cheap. */
function Board({ title, icon, rows, prefix = '', ...props }) {
  const key = JSON.stringify(rows)
  return (
    <group {...props}>
      <Solid>
        <Block pos={[0, 4, -0.3]} size={[6.4, 8, 0.5]} color={BOARD} />
      </Solid>
      <CanvasSign
        position={[0, 4, 0]}
        size={[5.9, 7.5]}
        resolution={80}
        transparent={false}
        emissive={0.5}
        deps={[key]}
        draw={(g, w, h) => {
          g.fillStyle = '#3a2412'
          g.fillRect(0, 0, w, h)
          g.fillStyle = '#5a3a1e'
          g.fillRect(10, 10, w - 20, h - 20)
          drawGameText(g, `${icon} ${title}`, w / 2, 48, 40, '#ffe14d')
          const top = 100
          const rh = (h - top - 20) / 8
          for (let i = 0; i < 8; i++) {
            const [name, value] = rows[i] || ['—', null]
            const y = top + i * rh + rh / 2
            g.fillStyle = i % 2 ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.06)'
            g.fillRect(16, y - rh / 2 + 2, w - 32, rh - 4)
            const medal = ['#ffd700', '#d9d9e6', '#e08a3c'][i] || '#ffffff'
            drawGameText(g, `${i + 1}`, 42, y, rh * 0.5, medal, '#101018')
            drawGameText(g, String(name).slice(0, 14), 72, y, rh * 0.42, '#ffffff', '#101018', 'left')
            if (value !== null) {
              drawGameText(g, prefix + fmt(value), w - 28, y, rh * 0.42, '#6bff3a', '#101018', 'right')
            }
          }
        }}
      />
    </group>
  )
}

/** A blocky winged statue on the centre pedestal. */
function Angel(props) {
  const white = '#f4f6ff'
  return (
    <group {...props}>
      <Block pos={[0, 0.6, 0]} size={[0.9, 1.2, 0.5]} color={white} />
      <Block pos={[0, 1.8, 0]} size={[1.1, 1.2, 0.55]} color={white} />
      <Block pos={[0, 2.8, 0]} size={[0.75, 0.75, 0.75]} color={white} />
      <Block pos={[0, 3.35, 0]} size={[1, 0.08, 1]} color="#ffd700" emissive={0.8} />
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 0.5, 2.1, -0.35]} rotation={[0, s * 0.5, s * 0.35]}>
          <Block pos={[s * 1.1, 0.2, 0]} size={[2.2, 0.9, 0.15]} color={white} />
          <Block pos={[s * 1.4, -0.5, 0]} size={[1.6, 0.7, 0.15]} color={white} />
        </group>
      ))}
    </group>
  )
}

export function Champions() {
  const lb = useGame((s) => s.leaderboard)
  const { x, z } = CHAMPIONS
  const champs = lb.champs || {}

  return (
    // The whole podium faces -X, back toward the plaza.
    <group position={[x, 0, z]} rotation={[0, -Math.PI / 2, 0]}>
      <Solid>
        {/* Stepped red-carpet stage */}
        <Block pos={[0, 0.25, -3]} size={[26, 0.5, 8]} color="#9aa0c8" />
        <Block pos={[0, 0.75, -4]} size={[22, 0.5, 6]} color="#9aa0c8" />
        <Block pos={[0, 1.2, -1]} size={[4, 0.1, 6]} color={RED} />
      </Solid>

      {/* Red gate with the Champions sign */}
      <Solid>
        <Block pos={[-7, 6, -6.5]} size={[1.4, 12, 1.4]} color={RED} />
        <Block pos={[7, 6, -6.5]} size={[1.4, 12, 1.4]} color={RED} />
      </Solid>
      <Block pos={[0, 12.4, -6.5]} size={[17, 1, 1.8]} color={RED} />
      <Block pos={[0, 10.6, -6.4]} size={[12, 2.6, 1]} color={RED} />
      <CanvasSign
        position={[0, 10.6, -5.88]}
        size={[11.6, 2.4]}
        draw={(g, w, h) => drawGameText(g, 'Champions', w / 2, h / 2, h * 0.6)}
      />

      {/* Each board's #1 dances on the stage in front of it. */}
      <Dancer champ={champs.strength} title="💪 #1 Strength" color="#ff5a5a" position={[-4.3, 1, -3]} />
      <Dancer champ={champs.cash} title="💵 #1 Cash" color="#6bff3a" position={[4.3, 1, -3]} offset={0.9} />
      <Dancer champ={champs.rebirths} title="🔄 #1 Rebirths" color="#c054ff" position={[0, 1.2, -0.6]} offset={1.7} />
      {/* The angel stands on top of the gate, clear of the scoreboards. */}
      <Angel position={[0, 12.9, -6.5]} scale={0.9} />

      <Board title="Most Strength" icon="💪" rows={lb.strength || []} position={[-9, 1, -2]} rotation={[0, 0.35, 0]} />
      <Board title="Most Cash" icon="💵" prefix="$" rows={lb.cash || []} position={[9, 1, -2]} rotation={[0, -0.35, 0]} />
      <Board title="Most Rebirths" icon="🔄" rows={lb.rebirths || []} position={[0, 1, -8.2]} />
    </group>
  )
}

export default Champions

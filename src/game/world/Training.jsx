import { Sparkles } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { AdditiveBlending, CanvasTexture, SRGBColorSpace } from 'three'

import { useGame } from '../../net/gameStore'
import { FREE_PADS, TRAINING_ZONES, fmt } from '../../shared/gameConfig'
import { crystalGeo, gemMat } from '../itemMaterials'
import { TIERS, useQuality } from '../quality'
import { drawGameText } from './blockKit'
import { Block, Solid } from './blocks'
import { CanvasSign } from './CanvasSign'

const STONE = '#a3a8d0'
const STONE_DARK = '#7d82ad'
const ROCKS = ['#6e7294', '#7c80a3', '#62668a']

/** A glowing magic circle, drawn once and tinted per pad. */
function runeTexture() {
  const s = 512
  const c = document.createElement('canvas')
  c.width = c.height = s
  const g = c.getContext('2d')
  g.translate(s / 2, s / 2)
  g.strokeStyle = '#ffffff'
  g.shadowColor = '#ffffff'
  g.shadowBlur = 18
  for (const [r, w] of [
    [0.47, 10],
    [0.4, 5],
    [0.2, 6],
  ]) {
    g.lineWidth = w
    g.beginPath()
    g.arc(0, 0, s * r, 0, Math.PI * 2)
    g.stroke()
  }
  // Ticks between the two outer rings, and a star in the middle.
  g.lineWidth = 6
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2
    g.beginPath()
    g.moveTo(Math.cos(a) * s * 0.4, Math.sin(a) * s * 0.4)
    g.lineTo(Math.cos(a) * s * (i % 2 ? 0.44 : 0.47), Math.sin(a) * s * (i % 2 ? 0.44 : 0.47))
    g.stroke()
  }
  g.beginPath()
  for (let i = 0; i <= 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2
    const r = i % 2 ? s * 0.16 : s * 0.36
    g.lineTo(Math.cos(a) * r, Math.sin(a) * r)
  }
  g.stroke()
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  return t
}

/** Big glowing crystal cluster that floats above the rock pile. */
function CrystalCluster({ color }) {
  const ref = useRef()
  useFrame((st) => {
    if (!ref.current) return
    ref.current.position.y = 3.1 + Math.sin(st.clock.elapsedTime * 1.3) * 0.18
    ref.current.rotation.y = st.clock.elapsedTime * 0.25
  })
  const shards = [
    [0, 0, 0, 0, 3.4],
    [0.45, 0.1, 0.5, 0.35, 2.4],
    [-0.4, -0.2, -0.45, -0.3, 2.2],
    [0.1, 0.45, 0.2, 0.5, 1.8],
    [-0.15, -0.5, -0.1, -0.55, 2],
    [0.5, -0.4, 0.6, -0.45, 1.5],
  ]
  return (
    <group ref={ref}>
      {shards.map(([x, z, rx, rz, s], i) => (
        <mesh
          key={i}
          geometry={crystalGeo()}
          material={gemMat(color)}
          position={[x, 0, z]}
          rotation={[rx, i * 1.1, rz]}
          scale={s}
          castShadow
        />
      ))}
    </group>
  )
}

/** Stone post with a spinning glowing cube on top. */
function Beacon({ color, ...props }) {
  const ref = useRef()
  useFrame((st, dt) => {
    if (!ref.current) return
    ref.current.rotation.y += dt * 1.5
    ref.current.rotation.x += dt * 0.7
  })
  return (
    <group {...props}>
      <Block pos={[0, 0.75, 0]} size={[0.7, 1.5, 0.7]} color={STONE_DARK} />
      <Block pos={[0, 1.6, 0]} size={[0.9, 0.2, 0.9]} color={STONE} />
      <group ref={ref} position={[0, 2.3, 0]}>
        <Block pos={[0, 0, 0]} size={[0.5, 0.5, 0.5]} color={color} emissive={1.6} shadow={false} />
      </group>
    </group>
  )
}

/** One training pad: stand on it and click for a strength multiplier. */
function Pad({ zone, rune }) {
  const owned = useGame((s) => FREE_PADS.includes(zone.id) || Boolean(s.me?.pads?.includes(zone.id)))
  const rebirths = useGame((s) => s.me?.rebirths ?? 0)
  const runeRef = useRef()
  useFrame((st) => {
    const m = runeRef.current
    if (!m) return
    m.rotation.z = st.clock.elapsedTime * 0.35
    // Owned pads pulse brightly; locked ones glow dimly.
    m.material.opacity = owned ? 0.6 + Math.sin(st.clock.elapsedTime * 2.2) * 0.25 : 0.18
  })

  const c = zone.crystal
  const effects = useQuality((s) => TIERS[s.tier].effects)
  return (
    <group position={[zone.x, 0, zone.z]}>
      {/* Two thin tiers, visual only: even a 0.2 step stops the player capsule,
          so you walk "onto" the pad without a collider in the way. */}
      <Block pos={[0, 0.06, 0]} size={[9.4, 0.12, 9.4]} color={STONE} shadow={false} />
      <Block pos={[0, 0.14, 0]} size={[7.4, 0.12, 7.4]} color={STONE_DARK} shadow={false} />
      <Solid>
        {/* Rock pile at the back */}
        <Block pos={[-5.6, 1.1, 0]} size={[2.6, 2.2, 5.4]} color={ROCKS[0]} rot={[0, 0.08, 0]} />
        <Block pos={[-5.4, 2.6, 0.6]} size={[2, 1.4, 3]} color={ROCKS[1]} rot={[0, -0.2, 0.05]} />
        <Block pos={[-5.9, 0.7, -2.4]} size={[1.8, 1.4, 1.8]} color={ROCKS[2]} rot={[0, 0.5, 0]} />
        <Block pos={[-5.2, 0.6, 2.6]} size={[1.6, 1.2, 1.6]} color={ROCKS[2]} rot={[0, -0.4, 0]} />
      </Solid>

      {/* Glowing trim around the inner tier */}
      {[
        [0, 3.72, 7.44, 0.12],
        [0, -3.72, 7.44, 0.12],
        [3.72, 0, 0.12, 7.44],
        [-3.72, 0, 0.12, 7.44],
      ].map(([x, z, w, d], i) => (
        <Block key={i} pos={[x, 0.22, z]} size={[w, 0.06, d]} color={c} emissive={1.4} shadow={false} />
      ))}

      {/* Magic circle on the pad */}
      <mesh ref={runeRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.23, 0]}>
        <planeGeometry args={[6.6, 6.6]} />
        <meshBasicMaterial
          map={rune}
          color={c}
          transparent
          opacity={0.7}
          blending={AdditiveBlending}
          depthWrite={false}
          polygonOffset
          polygonOffsetFactor={-4}
        />
      </mesh>

      <group position={[-5.5, 0, 0]}>
        <CrystalCluster color={c} />
      </group>
      <Beacon color={c} position={[3.9, 0, 3.9]} />
      <Beacon color={c} position={[3.9, 0, -3.9]} />

      {owned && effects && <Sparkles count={28} scale={[7, 4, 7]} position={[0, 2, 0]} size={6} speed={0.6} color={c} />}

      <CanvasSign
        position={[-3.2, 7.2, 0]}
        rotation={[0, Math.PI / 2, 0]}
        size={[6, 2]}
        deps={[zone.mult, owned, rebirths >= zone.rebirths]}
        draw={(g, w, h) => {
          // Top line: what it takes to use this pad.
          let line = '✅ OWNED'
          let color = '#6bff3a'
          if (!owned && rebirths < zone.rebirths) {
            line = `🔒 ${zone.rebirths} Rebirths`
            color = '#ff6b6b'
          } else if (!owned) {
            line = zone.cost ? `E  ·  $${fmt(zone.cost)}` : 'FREE'
            color = '#ffffff'
          }
          g.fillStyle = 'rgba(20,20,35,0.8)'
          g.beginPath()
          g.roundRect(w * 0.2, 4, w * 0.6, h * 0.42, 14)
          g.fill()
          drawGameText(g, line, w / 2, h * 0.24, h * 0.26, color)
          drawGameText(g, `x${fmt(zone.mult)} Strength`, w / 2, h * 0.72, h * 0.34, '#ffe14d')
        }}
      />
    </group>
  )
}

export function Training() {
  const rune = useMemo(() => runeTexture(), [])
  const zs = TRAINING_ZONES.map((z) => z.z)
  const zMin = Math.min(...zs)
  const zMax = Math.max(...zs)
  const archX = TRAINING_ZONES[0].x + 10
  return (
    <group>
      {TRAINING_ZONES.map((z) => (
        <Pad key={z.id} zone={z} rune={rune} />
      ))}

      {/* Blue "Training Area" arch facing the plaza */}
      <group position={[archX, 0, (zMin + zMax) / 2]} rotation={[0, Math.PI / 2, 0]}>
        <Solid>
          <Block pos={[-6, 4.5, 0]} size={[1.4, 9, 1.4]} color="#2f6bff" />
          <Block pos={[6, 4.5, 0]} size={[1.4, 9, 1.4]} color="#2f6bff" />
        </Solid>
        <Block pos={[0, 9.4, 0]} size={[14.5, 2.4, 1]} color="#2f6bff" />
        <CanvasSign
          position={[0, 9.4, 0.52]}
          size={[13.6, 2]}
          draw={(g, w, h) => drawGameText(g, 'Training Area', w / 2, h / 2, h * 0.55)}
        />
        <CanvasSign
          position={[0, 9.4, -0.52]}
          rotation={[0, Math.PI, 0]}
          size={[13.6, 2]}
          draw={(g, w, h) => drawGameText(g, 'Training Area', w / 2, h / 2, h * 0.55)}
        />
      </group>
    </group>
  )
}

export default Training

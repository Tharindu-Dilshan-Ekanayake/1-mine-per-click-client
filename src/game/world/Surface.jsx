import { useLayoutEffect, useMemo, useRef } from 'react'
import { CanvasTexture, Object3D, RepeatWrapping, SRGBColorSpace } from 'three'

import { useGame } from '../../net/gameStore'
import { PIT, SHAFT_WALL, SPAWN, WORLD_HALF } from '../../shared/gameConfig'
import { drawGameText, rainbowGradient, studBox, studMaterial } from './blockKit'
import { Block, Solid } from './blocks'
import { CanvasSign } from './CanvasSign'
import { Trees } from './Trees'

const GRASS = '#4ec23c'
const STONE = '#b9bcd9'
const BRICK = '#e8742a'
const ROCK = '#aeb2d4'

const H = WORLD_HALF + 3 // ground extends a little under the walls
const px0 = PIT.x - PIT.size / 2
const px1 = PIT.x + PIT.size / 2
const pz0 = PIT.z - PIT.size / 2
const pz1 = PIT.z + PIT.size / 2
// The ground's hole includes the shaft walls' footprint, so the walls fill its rim
// instead of sharing a face with it (that shared face is what z-fought).
const hx0 = px0 - SHAFT_WALL
const hx1 = px1 + SHAFT_WALL
const hz0 = pz0 - SHAFT_WALL
const hz1 = pz1 + SHAFT_WALL

/** [x0, x1, z0, z1] rectangles -> centred box args. */
const rect = (x0, x1, z0, z1) => ({
  pos: [(x0 + x1) / 2, 0, (z0 + z1) / 2],
  w: x1 - x0,
  d: z1 - z0,
})

/** Ground slab with a square hole where the pit's first barrier sits. */
function Ground() {
  const parts = [
    rect(-H, H, -H, hz0),
    rect(-H, H, hz1, H),
    rect(-H, hx0, hz0, hz1),
    rect(hx1, H, hz0, hz1),
  ]
  return (
    <Solid name="ground">
      {parts.map((p, i) => (
        <Block
          key={i}
          pos={[p.pos[0], -1, p.pos[2]]}
          size={[p.w, 2, p.d]}
          color={GRASS}
          shadow={false}
        />
      ))}
    </Solid>
  )
}

/** Lavender stone paths, visual only (they sit a hair above the grass). */
function Paths() {
  const around = [
    // Central plaza
    rect(-17, 17, -18, 17),
    // Ring around the pit (the pit itself stays open)
    rect(-9, 9, -38, pz0),
    rect(-9, px0, pz0, pz1),
    rect(px1, 9, pz0, pz1),
    rect(-9, 9, pz1, -18),
    // West: path + training grounds
    rect(-28, -17, -14, 14),
    rect(-46, -28, -35, 35),
    // East: path + champions plaza
    rect(17, 24, -10, 6),
    rect(24, 46, -20, 12),
  ]
  return around.map((p, i) => (
    <Block
      key={i}
      pos={[p.pos[0], 0.03, p.pos[2]]}
      size={[p.w, 0.06, p.d]}
      color={STONE}
      shadow={false}
    />
  ))
}

/** Perimeter wall with battlements, instanced so 120+ merlons cost one draw call. */
function Walls() {
  const merlonRef = useRef()
  const capRef = useRef()
  const WALL_H = 8
  const L = WORLD_HALF * 2 + 2

  const merlons = useMemo(() => {
    const list = []
    for (let i = -WORLD_HALF; i <= WORLD_HALF; i += 4) {
      list.push([i, -WORLD_HALF], [i, WORLD_HALF], [-WORLD_HALF, i], [WORLD_HALF, i])
    }
    return list
  }, [])

  useLayoutEffect(() => {
    const o = new Object3D()
    merlons.forEach(([x, z], i) => {
      o.position.set(x, WALL_H + 1, z)
      o.updateMatrix()
      merlonRef.current.setMatrixAt(i, o.matrix)
      o.position.set(x, WALL_H + 2.3, z)
      o.updateMatrix()
      capRef.current.setMatrixAt(i, o.matrix)
    })
    merlonRef.current.instanceMatrix.needsUpdate = true
    capRef.current.instanceMatrix.needsUpdate = true
  }, [merlons])

  return (
    <>
      <Solid name="walls">
        <Block pos={[0, WALL_H / 2, -WORLD_HALF]} size={[L, WALL_H, 2]} color={BRICK} shadow={false} />
        <Block pos={[0, WALL_H / 2, WORLD_HALF]} size={[L, WALL_H, 2]} color={BRICK} shadow={false} />
        <Block pos={[-WORLD_HALF, WALL_H / 2, 0]} size={[2, WALL_H, L]} color={BRICK} shadow={false} />
        <Block pos={[WORLD_HALF, WALL_H / 2, 0]} size={[2, WALL_H, L]} color={BRICK} shadow={false} />
      </Solid>
      {/* Green ledge along the wall tops */}
      {[
        [0, -WORLD_HALF, L, 2.6],
        [0, WORLD_HALF, L, 2.6],
        [-WORLD_HALF, 0, 2.6, L],
        [WORLD_HALF, 0, 2.6, L],
      ].map(([x, z, w, d], i) => (
        <Block key={i} pos={[x, WALL_H + 0.2, z]} size={[w, 0.4, d]} color={GRASS} shadow={false} />
      ))}
      <instancedMesh
        ref={merlonRef}
        args={[studBox(2, 2, 2), studMaterial(BRICK), merlons.length]}
      />
      <instancedMesh
        ref={capRef}
        args={[studBox(2.2, 0.6, 2.2), studMaterial(GRASS), merlons.length]}
      />
    </>
  )
}

/** Decorative stud boulders, the lavender rock piles from the screenshots. */
function Rocks() {
  const piles = [
    [-41, -40],
    [40, -38],
    [-41, 39],
    [38, 37],
    [18, -40],
    [-19, -41],
    [24, 26],
    [-12, 36],
  ]
  return (
    <Solid name="rocks">
      {piles.flatMap(([x, z], i) => [
        <Block key={`${i}a`} pos={[x, 1.5, z]} size={[5, 3, 4]} color={ROCK} />,
        <Block key={`${i}b`} pos={[x + 2.5, 1, z + 2]} size={[3, 2, 3]} color={ROCK} />,
        <Block key={`${i}c`} pos={[x - 1, 3.5, z - 0.5]} size={[2.5, 1.5, 2.5]} color={ROCK} />,
      ])}
    </Solid>
  )
}

/** Rim around the pit so its first barrier reads as "dig here". */
function PitRim() {
  const t = SHAFT_WALL
  const s = PIT.size
  const RIM = '#8a8fb8'
  return (
    <>
      <Block pos={[PIT.x, 0.12, pz0 - t / 2]} size={[s + 2 * t, 0.24, t]} color={RIM} />
      <Block pos={[PIT.x, 0.12, pz1 + t / 2]} size={[s + 2 * t, 0.24, t]} color={RIM} />
      <Block pos={[px0 - t / 2, 0.12, PIT.z]} size={[t, 0.24, s]} color={RIM} />
      <Block pos={[px1 + t / 2, 0.12, PIT.z]} size={[t, 0.24, s]} color={RIM} />
    </>
  )
}

/**
 * The board behind the pit: "Start Mining" up top (no longer a separate
 * signpost standing in the walking path - it used to have its own colliding
 * posts right where players cross toward the pit) with the event timers
 * ("Legendary / Mythic / Secret spawning in ...") below it.
 */
function TimerBoard() {
  const timers = useGame((s) => s.timers)
  const fmtT = (s) => `${Math.floor(s / 60)}m ${s % 60}s`

  return (
    <group position={[PIT.x, 0, pz0 - 8]}>
      <Solid>
        <Block pos={[-7.6, 4, 0]} size={[0.8, 8, 0.8]} color="#6b5fb0" />
        <Block pos={[7.6, 4, 0]} size={[0.8, 8, 0.8]} color="#6b5fb0" />
      </Solid>
      {/* "Start Mining" ribbon, mounted above the timer board rather than
          standing in the path on its own posts. */}
      <Block pos={[0, 9.55, 0]} size={[8, 1.5, 0.4]} color="#2d3a4f" />
      <CanvasSign
        position={[0, 9.55, 0.22]}
        size={[7.6, 1.4]}
        draw={(g, w, h) => drawGameText(g, 'Start Mining ⛏', w / 2, h / 2, h * 0.42, '#6bff3a')}
      />
      <Block pos={[0, 6, 0]} size={[15, 5.4, 0.5]} color="#6b5fb0" />
      <CanvasSign
        position={[0, 6, 0.27]}
        size={[14.2, 4.8]}
        resolution={72}
        transparent={false}
        emissive={0.55}
        deps={[timers.legendaryIn, timers.mythicIn, timers.secretIn]}
        draw={(g, w, h) => {
          g.fillStyle = '#1b2440'
          g.fillRect(0, 0, w, h)
          const rows = [
            ['Legendary', timers.legendaryIn, '#e0182d'],
            ['Mythic', timers.mythicIn, 'rainbow'],
            ['Secret', timers.secretIn, '#101522'],
          ]
          const rh = h / 3
          rows.forEach(([label, t, bg], i) => {
            g.fillStyle = bg === 'rainbow' ? rainbowGradient(g, 0, w) : bg
            g.fillRect(8, i * rh + 6, w - 16, rh - 12)
            drawGameText(g, `${label} Spawning in: ${fmtT(t)}`, w / 2, i * rh + rh / 2, rh * 0.42)
          })
        }}
      />
    </group>
  )
}

function spikyTexture() {
  const s = 512
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = s
  const g = canvas.getContext('2d')
  g.translate(s / 2, s / 2)
  g.fillStyle = 'rgba(20,20,30,0.85)'
  const spikes = 12
  g.beginPath()
  for (let i = 0; i <= spikes * 2; i++) {
    const r = i % 2 === 0 ? s * 0.48 : s * 0.2
    const a = (i / (spikes * 2)) * Math.PI * 2
    const bend = i % 2 === 0 ? 0.18 : 0
    g.lineTo(Math.cos(a + bend) * r, Math.sin(a + bend) * r)
  }
  g.fill()
  g.globalCompositeOperation = 'destination-out'
  g.beginPath()
  g.arc(0, 0, s * 0.14, 0, Math.PI * 2)
  g.fill()
  const tex = new CanvasTexture(canvas)
  tex.colorSpace = SRGBColorSpace
  return tex
}

function checkerTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 32
  canvas.height = 32
  const g = canvas.getContext('2d')
  for (let y = 0; y < 2; y++)
    for (let x = 0; x < 2; x++) {
      g.fillStyle = (x + y) % 2 ? '#15151f' : '#ffffff'
      g.fillRect(x * 16, y * 16, 16, 16)
    }
  const tex = new CanvasTexture(canvas)
  tex.wrapS = tex.wrapT = RepeatWrapping
  tex.colorSpace = SRGBColorSpace
  tex.repeat.set(1, 24)
  tex.magFilter = 1003 // NearestFilter
  return tex
}

function Decals() {
  const spiky = useMemo(() => spikyTexture(), [])
  const checker = useMemo(() => checkerTexture(), [])
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[SPAWN.x, 0.08, SPAWN.z - 2]}>
        <planeGeometry args={[9, 9]} />
        <meshBasicMaterial map={spiky} transparent depthWrite={false} polygonOffset polygonOffsetFactor={-4} />
      </mesh>
      {[-8, 8].map((x) => (
        <mesh key={x} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.08, -6]}>
          <planeGeometry args={[1, 24]} />
          <meshStandardMaterial map={checker} polygonOffset polygonOffsetFactor={-4} />
        </mesh>
      ))}
    </>
  )
}

export function Surface() {
  return (
    <group>
      <Ground />
      <Paths />
      <Walls />
      <Trees />
      <Rocks />
      <PitRim />
      <TimerBoard />
      <Decals />
    </group>
  )
}

export default Surface

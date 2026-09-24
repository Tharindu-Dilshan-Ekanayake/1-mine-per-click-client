import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { RigidBody } from '@react-three/rapier'
import { memo, useEffect, useMemo, useRef } from 'react'
import { Color } from 'three'

import { useGame } from '../../net/gameStore'
import {
  BARRIER_THICK,
  BARRIERS_PER_STAGE,
  PIT,
  ROOM,
  SHAFT_WALL,
  STAGES,
  barrierInfo,
  fmt,
  roomCeilingY,
  roomFloorY,
  roomObstacles,
  stagePickaxe,
  stagePitZ,
  stageTopY,
} from '../../shared/gameConfig'
import { spawnDebris } from '../fx'
import { crystalGeo, gemMat } from '../itemMaterials'
import { localPlayer } from '../localPlayer'
import { sfx } from '../sound'
import { drawGameText } from './blockKit'
import { Block, Solid } from './blocks'
import { CanvasSign } from './CanvasSign'
import { crackStage, crackTextures } from './cracks'

const HALF = PIT.size / 2
/**
 * Holes in floors/ceilings are cut out to the OUTSIDE of the shaft walls, so the
 * walls fill the hole's rim. If the hole matched the pit exactly, the hole's edge
 * faces and the walls' inner faces would be coplanar and z-fight (the flicker you
 * could see looking down a dug shaft).
 */
const HOLE_HALF = HALF + SHAFT_WALL
const W = ROOM.halfWidth
/** Render this many stages above/below the player's current one. */
const WINDOW_UP = 1
const WINDOW_DOWN = 2

/** Slab pieces covering [x0,x1]x[z0,z1] at height y, leaving a square hole. */
function slabWithHole(y, x0, x1, z0, z1, holeZ, thickness = 1) {
  const pieces = []
  const add = (ax0, ax1, az0, az1) => {
    if (ax1 - ax0 <= 0 || az1 - az0 <= 0) return
    pieces.push({
      pos: [(ax0 + ax1) / 2, y, (az0 + az1) / 2],
      size: [ax1 - ax0, thickness, az1 - az0],
    })
  }
  if (holeZ === null) {
    add(x0, x1, z0, z1)
    return pieces
  }
  const hz0 = holeZ - HOLE_HALF
  const hz1 = holeZ + HOLE_HALF
  add(x0, x1, hz1, z1)
  add(x0, x1, z0, hz0)
  add(x0, PIT.x - HOLE_HALF, hz0, hz1)
  add(PIT.x + HOLE_HALF, x1, hz0, hz1)
  return pieces
}

/** The vertical shaft you dig down through (walls only; barriers are separate). */
function Shaft({ stage }) {
  const s = STAGES[stage - 1]
  const top = stageTopY(stage)
  const bottom = roomCeilingY(stage)
  const h = top - bottom
  const zc = stagePitZ(stage)
  const y = top - h / 2
  const t = SHAFT_WALL
  return (
    <Solid name={`shaft-${stage}`}>
      <Block pos={[PIT.x - HALF - t / 2, y, zc]} size={[t, h, PIT.size + 2 * t]} color={s.wall} shadow={false} />
      <Block pos={[PIT.x + HALF + t / 2, y, zc]} size={[t, h, PIT.size + 2 * t]} color={s.wall} shadow={false} />
      <Block pos={[PIT.x, y, zc - HALF - t / 2]} size={[PIT.size, h, t]} color={s.wall} shadow={false} />
      <Block pos={[PIT.x, y, zc + HALF + t / 2]} size={[PIT.size, h, t]} color={s.wall} shadow={false} />
    </Solid>
  )
}

/** Glowing crystals growing out of the room walls; more (and bigger) deeper down. */
function WallCrystals({ stage, floor, zBack, zFront, color }) {
  const list = useMemo(() => {
    const out = []
    const n = 3 + Math.floor(stage * 0.9)
    for (let i = 0; i < n; i++) {
      const side = i % 2 ? 1 : -1
      const t = (i + 0.5) / n
      out.push({
        x: side * (W - 0.1),
        y: floor + 1.5 + ((i * 37) % 50) / 10,
        z: zBack - 2 - t * (zBack - zFront - 4),
        rz: side * (0.9 + ((i * 13) % 5) / 10),
        rx: (((i * 7) % 10) - 5) / 10,
        s: 0.9 + stage * 0.05 + ((i * 11) % 4) / 10,
      })
    }
    return out
  }, [stage, floor, zBack, zFront])
  return list.map((c, i) => (
    <group key={i} position={[c.x, c.y, c.z]} rotation={[c.rx, 0, c.rz]}>
      <mesh geometry={crystalGeo()} material={gemMat(color)} scale={c.s} />
      <mesh geometry={crystalGeo()} material={gemMat(color)} scale={c.s * 0.6} rotation={[0.5, 1, 0.4]} />
    </group>
  ))
}

/** A stage room: floor (with the next pit), ceiling (with the shaft you fell in by), walls. */
const Room = memo(function Room({ stage }) {
  const s = STAGES[stage - 1]
  const zc = stagePitZ(stage)
  const floor = roomFloorY(stage)
  const ceil = roomCeilingY(stage)
  const zBack = zc + ROOM.back
  const zFront = zc - ROOM.front
  const isLast = stage === STAGES.length
  const nextPitZ = isLast ? null : stagePitZ(stage + 1)
  const wallH = ceil - floor + 1
  const wallY = floor + (ceil - floor) / 2
  const nextPick = isLast ? null : stagePickaxe(stage + 1)

  const floorPieces = slabWithHole(floor - 0.5, -W - 1, W + 1, zFront - 1, zBack + 1, nextPitZ)
  const ceilPieces = slabWithHole(ceil + 0.5, -W - 1, W + 1, zFront - 1, zBack + 1, zc)
  const obstacles = useMemo(() => roomObstacles(stage), [stage])

  // Block piles hugging the side walls, like the cave screenshots.
  const piles = []
  for (let z = zBack - 4; z > zFront + 3; z -= 7) {
    const side = piles.length % 2 ? 1 : -1
    piles.push({ x: side * (W - 1.5), z, h: 2 + (piles.length % 3) })
    piles.push({ x: -side * (W - 1.2), z: z - 3.5, h: 1.5 + ((piles.length + 1) % 2) })
  }

  return (
    <group>
      <Solid name={`room-${stage}`}>
        {floorPieces.map((p, i) => (
          <Block key={`f${i}`} pos={p.pos} size={p.size} color={s.floor} shadow={false} />
        ))}
        {ceilPieces.map((p, i) => (
          <Block key={`c${i}`} pos={p.pos} size={p.size} color={s.wall} shadow={false} />
        ))}
        <Block pos={[-W - 0.5, wallY, (zBack + zFront) / 2]} size={[1, wallH, zBack - zFront + 2]} color={s.wall} shadow={false} />
        <Block pos={[W + 0.5, wallY, (zBack + zFront) / 2]} size={[1, wallH, zBack - zFront + 2]} color={s.wall} shadow={false} />
        <Block pos={[0, wallY, zBack + 0.5]} size={[2 * W, wallH, 1]} color={s.wall} shadow={false} />
        <Block pos={[0, wallY, zFront - 0.5]} size={[2 * W, wallH, 1]} color={s.wall} shadow={false} />
        {piles.map((p, i) => (
          <Block key={`p${i}`} pos={[p.x, floor + p.h / 2, p.z]} size={[2.4, p.h, 2.6]} color={s.accent} />
        ))}
        {/* Obstacles: pillars, then partition walls with one gap (deeper = more) */}
        {obstacles.map((o, i) => (
          <Block
            key={`o${i}`}
            pos={[o.x, floor + o.h / 2, o.z]}
            size={[o.w, o.h, o.d]}
            color={o.kind === 'wall' ? s.wall : s.accent}
          />
        ))}
      </Solid>

      <WallCrystals stage={stage} floor={floor} zBack={zBack} zFront={zFront} color={s.accent} />

      {/* Torches along the side walls */}
      {[zBack - 6, zc - 12, zFront + 8].flatMap((z) =>
        [-1, 1].map((side) => (
          <group key={`${z}${side}`} position={[side * (W - 0.3), floor + 5, z]}>
            <Block pos={[0, 0, 0]} size={[0.3, 1, 0.3]} color="#6b4423" shadow={false} />
            <Block pos={[0, 0.65, 0]} size={[0.4, 0.4, 0.4]} color="#ffb02e" emissive={1.5} shadow={false} />
          </group>
        )),
      )}

      {/* Rim around the pit down to the next stage (sits on top of its shaft walls) */}
      {!isLast &&
        [
          [0, nextPitZ - HALF - 0.5, PIT.size + 2, 1],
          [0, nextPitZ + HALF + 0.5, PIT.size + 2, 1],
          [-HALF - 0.5, nextPitZ, 1, PIT.size],
          [HALF + 0.5, nextPitZ, 1, PIT.size],
        ].map(([x, z, w, d], i) => (
          <Block key={`r${i}`} pos={[x, floor + 0.12, z]} size={[w, 0.24, d]} color="#8a8fb8" />
        ))}

      <CanvasSign
        position={[0, floor + 6.2, zFront + 0.03]}
        size={[16, 3.4]}
        deps={[stage, nextPick?.id]}
        draw={(g, w, h) => {
          drawGameText(g, `STAGE ${stage}`, w / 2, h * 0.22, h * 0.26, '#ffe14d')
          drawGameText(g, s.name, w / 2, h * 0.52, h * 0.22)
          if (nextPick) {
            drawGameText(g, `⬇ Stage ${stage + 1} needs ${nextPick.name} Pickaxe`, w / 2, h * 0.82, h * 0.16, '#ff9d5c')
          } else {
            drawGameText(g, '🏆 The deepest stage!', w / 2, h * 0.82, h * 0.16, '#6bff3a')
          }
        }}
      />
      <CanvasSign
        position={[0, floor + 6.2, zBack - 0.03]}
        rotation={[0, Math.PI, 0]}
        size={[10, 1.6]}
        deps={[stage]}
        draw={(g, w, h) => drawGameText(g, `⬆ Stage ${stage}: ${s.name}`, w / 2, h / 2, h * 0.45)}
      />
    </group>
  )
})

const _dark = new Color('#1a1a1a')
const _col = new Color()

/** One diggable floor. Unmounting it removes its collider, so you drop through. */
function Barrier({ k, current }) {
  const info = barrierInfo(k)
  const s = STAGES[info.stage - 1]
  const meshRef = useRef()
  const hp = useGame((st) => (current ? st.me?.barrierHp ?? info.hp : info.hp))
  const damage = 1 - Math.max(0, hp) / info.hp
  // While standing on it the HUD shows the same bar, so drop the world tag.
  const standingOn = useGame((st) => st.location.onBarrier)

  // Wobble a little on each hit, and crack further as damage passes each quarter.
  const lastHp = useRef(hp)
  const shake = useRef(0)
  const stage = crackStage(damage)
  const lastStage = useRef(stage)
  useEffect(() => {
    if (hp < lastHp.current) shake.current = 0.18
    lastHp.current = hp
  }, [hp])
  useEffect(() => {
    if (stage > lastStage.current && current) {
      sfx.crack()
      const p = localPlayer.pos
      spawnDebris({ x: p.x, y: info.topY, z: p.z }, s.floor, 12, 5, 0.22)
    }
    lastStage.current = stage
  }, [stage, current, info.topY, s.floor])
  useFrame((_st, dt) => {
    if (!meshRef.current) return
    shake.current = Math.max(0, shake.current - dt)
    const a = shake.current * 0.6
    meshRef.current.position.x = info.x + (Math.random() - 0.5) * a
    meshRef.current.position.z = info.z + (Math.random() - 0.5) * a
  })

  // Quantised so a long dig reuses a handful of cached materials.
  _col.set(s.floor).lerp(_dark, (Math.round(damage * 8) / 8) * 0.55)
  const color = `#${_col.getHexString()}`
  const y = info.topY - BARRIER_THICK / 2

  return (
    <>
      <RigidBody type="fixed" colliders="cuboid" name={`barrier-${k}`}>
        <Block
          ref={meshRef}
          pos={[info.x, y, info.z]}
          size={[PIT.size, BARRIER_THICK, PIT.size]}
          color={color}
          cobble
          shadow={false}
        />
      </RigidBody>
      {stage > 0 && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[info.x, info.topY + 0.012, info.z]}>
          <planeGeometry args={[PIT.size, PIT.size]} />
          <meshBasicMaterial
            map={crackTextures()[stage - 1]}
            transparent
            depthWrite={false}
            polygonOffset
            polygonOffsetFactor={-4}
          />
        </mesh>
      )}
      {current && !standingOn && (
        <Html position={[info.x, info.topY + 4.2, info.z]} center distanceFactor={14} zIndexRange={[5, 0]}>
          <div className="barrier-tag">
            <div className="barrier-tag-title">
              Stage {info.stage} · Floor {info.layer + 1}/{BARRIERS_PER_STAGE}
            </div>
            <div className="hpbar">
              <div className="hpbar-fill" style={{ width: `${(1 - damage) * 100}%` }} />
              <span>
                {fmt(Math.max(0, hp))} / {fmt(info.hp)} HP
              </span>
            </div>
            <div className="barrier-tag-pick">⛏ {info.pickaxe.name}+</div>
          </div>
        </Html>
      )}
    </>
  )
}

export function Mine() {
  const mined = useGame((s) => s.me?.mined ?? 0)
  const here = useGame((s) => s.location.stage)
  const total = STAGES.length * BARRIERS_PER_STAGE

  // Only build the stages around the player; the rest of the 20-stage column
  // would just be hundreds of hidden meshes and colliders.
  const from = Math.max(1, here - WINDOW_UP)
  const to = Math.min(STAGES.length, Math.max(1, here) + WINDOW_DOWN)

  const stages = []
  for (let s = from; s <= to; s++) stages.push(s)

  const barriers = []
  const firstK = Math.max(mined, (from - 1) * BARRIERS_PER_STAGE)
  const lastK = Math.min(total, to * BARRIERS_PER_STAGE)
  for (let k = firstK; k < lastK; k++) {
    barriers.push(<Barrier key={k} k={k} current={k === mined} />)
  }

  return (
    <group>
      {stages.map((s) => (
        <group key={s}>
          <Shaft stage={s} />
          <Room stage={s} />
        </group>
      ))}
      {barriers}
    </group>
  )
}

export default Mine

import { useFrame, useThree } from '@react-three/fiber'
import { CapsuleCollider, RigidBody, useRapier } from '@react-three/rapier'
import { useEffect, useMemo, useRef } from 'react'
import { Quaternion, Vector3 } from 'three'

import { getGame, useGame } from '../net/gameStore'
import { getMe, getRoom, send } from '../net/network'
import {
  AUTO_TRAIN_RATE,
  BARRIERS_PER_STAGE,
  FREE_PADS,
  bagCapacity,
  ITEMS_BY_ID,
  PICKUP_RANGE,
  PIT,
  SPAWN,
  STAGES,
  STALL_RANGE,
  STALLS,
  barrierInfo,
  fmt,
  pickaxeIndex,
  roomFloorY,
  speedMult,
  stageAtY,
  trainingZoneAt,
} from '../shared/gameConfig'
import Character from './Character'
import { interact } from './interact'
import { localPlayer } from './localPlayer'
import { sfx } from './sound'
import { touchInput } from './touchInput'
import useKeyboard from './useKeyboard'
import { view } from './view'

// Capsule roughly matching the humanoid. Rapier's capsule args are the half-height of
// the *cylindrical* section plus the radius, so total height = 2*(halfHeight+radius).
const CAPSULE_RADIUS = 0.35
const CAPSULE_HALF_HEIGHT = 0.55
const PLAYER_HEIGHT = 2 * (CAPSULE_HALF_HEIGHT + CAPSULE_RADIUS)

const MOVE_SPEED = 7
const SPRINT_MULTIPLIER = 1.5
const JUMP_IMPULSE = 5.2
/** Extra ray length past the capsule bottom; tolerates small ground gaps. */
const GROUND_RAY_SLACK = 0.15
/** Stops one long Space press from re-triggering the moment the ray re-hits. */
const JUMP_COOLDOWN_S = 0.25

/** How fast A/D turn the camera (and the player with it), radians per second. */
const TURN_SPEED = 2.6
/** Distance covered per footstep sound, walking. */
const STRIDE = 1.7

/** Seconds between swings while the mouse is held (server caps at 12/s). */
const SWING_INTERVAL_S = 0.12
const NET_INTERVAL_S = 0.08
const SCAN_INTERVAL_S = 0.1
/** Below the deepest room: something went wrong, send them home. */
const KILL_Y = roomFloorY(STAGES.length) - 30

const STALL_ACTIONS = {
  sell: 'Sell Loot',
  upgrades: 'Upgrades',
  pickaxes: 'Pickaxes',
  auras: 'Auras',
}

// Clamps to [-1, 1]: keyboard contributes exactly ±1, the touch joystick a
// continuous amount, and both can be held at once.
const clamp1 = (n) => Math.max(-1, Math.min(1, n))

// Scratch objects, reused each frame so the loop allocates nothing.
const _input = new Vector3()
const _move = new Vector3()
const _camForward = new Vector3()
const _rayOrigin = new Vector3()
const _targetQuat = new Quaternion()
const _up = new Vector3(0, 1, 0)

/**
 * The local player: a dynamic Rapier capsule with the Bloxity avatar as its visual.
 * Movement is client-side; the position is streamed to the server, which uses it to
 * validate digging, pickups and selling.
 */
export function Player({ position = [SPAWN.x, SPAWN.y + 2, SPAWN.z], onAvatarReady, bodyRef: externalBodyRef }) {
  const localBodyRef = useRef(null)
  const bodyRef = externalBodyRef || localBodyRef
  const visualRef = useRef(null)
  const keys = useKeyboard()
  const { rapier, world } = useRapier()
  const gl = useThree((s) => s.gl)

  const pickaxe = useGame((s) => s.me?.pickaxe || 'wood')
  const aura = useGame((s) => s.me?.aura || 'none')
  const name = useGame((s) => s.me?.name || '')
  const bagType = useGame((s) => s.me?.bagType || 'starter')
  const bagLvl = useGame((s) => s.me?.bagLvl || 0)
  // Items still flying toward the bag aren't drawn inside it until they land.
  const flying = useGame((s) => s.flying)
  const bagKinds = useGame((s) => (s.me?.bag || []).map((b) => b.kind).join(','))
  const bag = useMemo(() => {
    const kinds = bagKinds ? bagKinds.split(',') : []
    const shown = kinds.slice(0, Math.max(0, kinds.length - flying))
    return {
      type: bagType,
      colors: shown.map((k) => ITEMS_BY_ID[k]?.color || '#ffffff'),
      cap: bagCapacity({ bagType, bagLvl }),
    }
  }, [bagType, bagLvl, bagKinds, flying])

  const jumpCooldown = useRef(0)
  const holding = useRef(false)
  const queuedClick = useRef(false)
  const autoTimer = useRef(0)
  const swingCooldown = useRef(0)
  const netTimer = useRef(0)
  const scanTimer = useRef(0)
  const lastTeleport = useRef(null)
  const stepDist = useRef(0)
  const airTime = useRef(0)
  const fallSpeed = useRef(0)

  /** Motion state for the avatar pose. A ref: written every frame, never rendered. */
  const motionRef = useRef({
    time: 0,
    speed: 0,
    grounded: true,
    maxSpeed: MOVE_SPEED,
    swingT: null,
    armAngle: null,
  })

  // Left mouse on the 3D view swings the pickaxe; holding it keeps swinging.
  useEffect(() => {
    const el = gl.domElement
    const down = (e) => {
      if (e.button !== 0) return
      holding.current = true
      // A quick click can press and release between two frames; queue it so the
      // frame loop still swings once.
      queuedClick.current = true
    }
    const up = (e) => {
      if (e.button === 0) holding.current = false
    }
    const blur = () => (holding.current = false)
    const onKey = (e) => {
      if (e.code !== 'KeyE' || e.repeat) return
      if (e.target instanceof HTMLInputElement) return
      if (getGame().modal) return
      interact()
    }
    el.addEventListener('pointerdown', down)
    window.addEventListener('pointerup', up)
    window.addEventListener('blur', blur)
    window.addEventListener('keydown', onKey)
    return () => {
      el.removeEventListener('pointerdown', down)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('blur', blur)
      window.removeEventListener('keydown', onKey)
    }
  }, [gl])

  /**
   * Grounded check: cast a short ray straight down from the capsule centre and see
   * whether it hits anything before clearing the capsule's own bottom.
   */
  const isGrounded = () => {
    const body = bodyRef.current
    if (!body) return false
    const pos = body.translation()
    _rayOrigin.set(pos.x, pos.y, pos.z)
    const ray = new rapier.Ray(_rayOrigin, { x: 0, y: -1, z: 0 })
    const maxDistance = CAPSULE_HALF_HEIGHT + CAPSULE_RADIUS + GROUND_RAY_SLACK
    const hit = world.castRay(ray, maxDistance, true, undefined, undefined, undefined, body)
    return hit !== null && hit.timeOfImpact <= maxDistance
  }

  const teleportTo = (x, y, z) => {
    const body = bodyRef.current
    if (!body) return
    body.setTranslation({ x, y, z }, true)
    body.setLinvel({ x: 0, y: 0, z: 0 }, true)
  }

  /** Finds the nearest thing to interact with and publishes it as the HUD prompt. */
  const scanSurroundings = (pos) => {
    const store = getGame()
    let best = null
    let bestDist = Infinity

    if (pos.y > -3) {
      for (const s of STALLS) {
        const d = Math.hypot(pos.x - s.x, pos.z - s.z)
        if (d < STALL_RANGE && d < bestDist) {
          bestDist = d
          best = { kind: 'stall', id: s.id, label: STALL_ACTIONS[s.id] }
        }
      }
    }

    // Standing on a pad you don't own yet: offer to unlock it (E).
    const me = getMe()
    const zone = trainingZoneAt(pos.x, pos.y, pos.z)
    const ownsZone = zone ? FREE_PADS.includes(zone.id) || Boolean(me?.pads?.includes(zone.id)) : false
    if (zone && !ownsZone) {
      const short = (me?.rebirths ?? 0) < zone.rebirths
      bestDist = 0
      best = {
        kind: 'pad',
        id: zone.id,
        label: short
          ? `🔒 x${zone.mult} pad needs ${zone.rebirths} rebirths`
          : `Unlock x${zone.mult} Strength pad — $${fmt(zone.cost)}`,
      }
    }

    const items = getRoom()?.state?.items
    items?.forEach((it, id) => {
      if (Math.abs(pos.y - roomFloorY(it.stage)) > 3) return
      const d = Math.hypot(pos.x - it.x, pos.z - it.z)
      if (d < PICKUP_RANGE - 0.8 && d < bestDist) {
        bestDist = d
        const def = ITEMS_BY_ID[it.kind]
        best = { kind: 'item', id, label: `Pickup ${def?.name || ''}?`, rarity: def?.rarity }
      }
    })

    const prev = store.prompt
    if ((prev?.kind ?? null) !== (best?.kind ?? null) || prev?.id !== best?.id) {
      useGame.setState({ prompt: best })
    }

    // Location, for the HUD banner and the loot culling.
    const stage = stageAtY(pos.y)
    const zoneMult = zone ? zone.mult : 0
    const zoneLocked = Boolean(zone) && !ownsZone
    let onBarrier = false
    let needPick = null
    if (me && me.mined < STAGES.length * BARRIERS_PER_STAGE) {
      const b = barrierInfo(me.mined)
      if (pickaxeIndex(me.pickaxe) < pickaxeIndex(b.pickaxe.id)) needPick = b.pickaxe.name
      const half = PIT.size / 2 + 0.6
      onBarrier =
        Math.abs(pos.x - b.x) <= half &&
        Math.abs(pos.z - b.z) <= half &&
        pos.y >= b.topY - 0.5 &&
        pos.y <= b.topY + 4
    }
    const loc = store.location
    if (
      loc.stage !== stage ||
      loc.zoneMult !== zoneMult ||
      loc.zoneLocked !== zoneLocked ||
      loc.onBarrier !== onBarrier ||
      loc.needPick !== needPick
    ) {
      useGame.setState({ location: { stage, zoneMult, zoneLocked, onBarrier, needPick } })
    }
    localPlayer.stage = stage
  }

  useFrame((state, delta) => {
    const body = bodyRef.current
    if (!body) return
    const store = getGame()
    const me = getMe()

    // --- Teleports requested by the HUD / server events --------------------------
    if (store.teleport && store.teleport.seq !== lastTeleport.current) {
      lastTeleport.current = store.teleport.seq
      teleportTo(SPAWN.x, SPAWN.y + 1, SPAWN.z)
      send('surface')
    }

    jumpCooldown.current = Math.max(0, jumpCooldown.current - delta)
    swingCooldown.current = Math.max(0, swingCooldown.current - delta)

    // Movement keys are ignored while a menu is open.
    const k = store.modal ? {} : keys.current
    const grounded = isGrounded()

    // --- Turning: A/D (or the touch joystick's X axis) swing the camera round,
    // and the player turns with it -----------------------------------------------
    const touchOn = store.modal ? 0 : 1
    const turn = clamp1((k.left ? 1 : 0) - (k.right ? 1 : 0) - touchInput.moveX * touchOn)
    if (turn) view.yaw += turn * TURN_SPEED * delta
    // Camera forward on the ground plane (the camera sits at +yaw, looking back).
    _camForward.set(-Math.sin(view.yaw), 0, -Math.cos(view.yaw))

    // --- Walking: W/S (or the joystick's Y axis) along the camera's forward --------
    _input.set(0, 0, clamp1((k.backward ? 1 : 0) - (k.forward ? 1 : 0) + touchInput.moveY * touchOn))
    const linvel = body.linvel()
    const baseSpeed = MOVE_SPEED * speedMult(me?.speedLvl ?? 0)

    if (_input.z !== 0) {
      _move.copy(_camForward).multiplyScalar(-_input.z)
      // A keyboard tap is always full speed; a light joystick push is slower.
      const speed = baseSpeed * (k.sprint ? SPRINT_MULTIPLIER : 1) * Math.min(1, Math.abs(_input.z))
      body.setLinvel({ x: _move.x * speed, y: linvel.y, z: _move.z * speed }, true)
    } else {
      body.setLinvel({ x: linvel.x * 0.8, y: linvel.y, z: linvel.z * 0.8 }, true)
    }
    if (visualRef.current && (_input.z !== 0 || turn)) {
      // Face where you walk; turning on the spot faces the camera's forward.
      const face = _input.z !== 0 ? _move : _camForward
      _targetQuat.setFromAxisAngle(_up, Math.atan2(face.x, face.z))
      visualRef.current.quaternion.slerp(_targetQuat, 1 - Math.pow(0.0005, delta))
    }

    // --- Jump ----------------------------------------------------------------------
    if ((k.jump || (touchInput.jump && touchOn)) && jumpCooldown.current === 0 && grounded) {
      body.applyImpulse({ x: 0, y: JUMP_IMPULSE, z: 0 }, true)
      jumpCooldown.current = JUMP_COOLDOWN_S
      sfx.jump()
      send('jump')
    }

    // --- Swing / mine ----------------------------------------------------------------
    const motion = motionRef.current
    // On a pad you own, the pickaxe swings by itself.
    const loc = store.location
    let autoSwing = false
    if (loc.zoneMult && !loc.zoneLocked) {
      autoTimer.current += delta
      if (autoTimer.current >= 1 / AUTO_TRAIN_RATE) autoSwing = true
    } else {
      autoTimer.current = 0
    }
    const wantSwing = holding.current || queuedClick.current || autoSwing || (touchInput.attack && touchOn)
    if (wantSwing && swingCooldown.current === 0 && !store.modal && me) {
      queuedClick.current = false
      autoTimer.current = 0
      swingCooldown.current = SWING_INTERVAL_S
      motion.swingT = 0
      sfx.swing()
      send('click')
    }

    // --- Publish motion state for the avatar's pose ---------------------------------
    const nowVel = body.linvel()
    motion.time += delta
    motion.speed = Math.hypot(nowVel.x, nowVel.z)
    motion.grounded = grounded
    motion.maxSpeed = baseSpeed * (k.sprint ? SPRINT_MULTIPLIER : 1)

    // --- Footsteps and landings ------------------------------------------------------
    if (grounded) {
      if (airTime.current > 0.25) sfx.land(Math.min(2, fallSpeed.current / 10))
      airTime.current = 0
      fallSpeed.current = 0
      if (motion.speed > 0.8) {
        stepDist.current += motion.speed * delta
        if (stepDist.current >= STRIDE * (k.sprint ? 1.25 : 1)) {
          stepDist.current = 0
          sfx.step()
        }
      } else {
        stepDist.current = STRIDE * 0.6 // first step comes quickly
      }
    } else {
      airTime.current += delta
      fallSpeed.current = Math.max(fallSpeed.current, -nowVel.y)
    }

    const pos = body.translation()
    localPlayer.pos.set(pos.x, pos.y, pos.z)

    if (pos.y < KILL_Y) {
      teleportTo(SPAWN.x, SPAWN.y + 1, SPAWN.z)
      send('surface')
    }

    // --- Network + surroundings, at a lower rate ----------------------------------
    netTimer.current += delta
    if (netTimer.current >= NET_INTERVAL_S) {
      netTimer.current = 0
      const ry = visualRef.current
        ? 2 * Math.atan2(visualRef.current.quaternion.y, visualRef.current.quaternion.w)
        : 0
      send('move', {
        x: pos.x,
        y: pos.y,
        z: pos.z,
        ry,
        spd: motion.speed,
        air: !grounded,
      })
    }

    scanTimer.current += delta
    if (scanTimer.current >= SCAN_INTERVAL_S) {
      scanTimer.current = 0
      scanSurroundings(pos)
    }
  })

  return (
    <RigidBody
      ref={bodyRef}
      position={position}
      colliders={false}
      mass={1}
      // Locking rotation keeps the capsule upright; facing is handled on the mesh.
      enabledRotations={[false, false, false]}
      friction={0.2}
      linearDamping={0.1}
      ccd
      name="player"
    >
      <CapsuleCollider args={[CAPSULE_HALF_HEIGHT, CAPSULE_RADIUS]} />
      {/* Avatar origin is at the feet; the capsule origin is at its centre. */}
      <group ref={visualRef} position={[0, -PLAYER_HEIGHT / 2, 0]}>
        <Character
          motionRef={motionRef}
          height={PLAYER_HEIGHT}
          pickaxe={pickaxe}
          aura={aura}
          name={name}
          bag={bag}
          reportLoading
          onReady={onAvatarReady}
        />
      </group>
    </RigidBody>
  )
}

export { PLAYER_HEIGHT }
export default Player

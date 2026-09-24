import { useFrame } from '@react-three/fiber'
import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { Quaternion, Vector3 } from 'three'

import { useGame } from '../net/gameStore'
import { getRoom } from '../net/network'
import { ITEMS_BY_ID, bagCapacity, fmt, levelInfo } from '../shared/gameConfig'
import Character from './Character'
import { remoteMotions } from './remoteActs'
import { PLAYER_HEIGHT } from './Player'

const _target = new Vector3()
const _quat = new Quaternion()
const _up = new Vector3(0, 1, 0)

function parseAvatar(json) {
  if (!json) return null
  try {
    return JSON.parse(json)
  } catch {
    return null
  }
}

/** Another player, smoothed toward the 12 Hz positions the server relays. */
const RemotePlayer = memo(function RemotePlayer({ id }) {
  const groupRef = useRef()
  const visualRef = useRef()
  const tagRef = useRef()
  const placed = useRef(false)
  const motionRef = useRef({ time: 0, speed: 0, grounded: true, maxSpeed: 7, swingT: null })

  // Cosmetics that only change on re-render (rare): read them from the schema once
  // per render, and re-render when they change via a cheap poll below.
  const p0 = getRoom()?.state?.players?.get(id)
  const [look, setLook] = useState(() => ({
    pickaxe: p0?.pickaxe || 'wood',
    aura: p0?.aura || 'none',
    name: p0?.name || '',
    avatar: p0?.avatar || '',
    bagType: p0?.bagType || 'starter',
    bagLvl: p0?.bagLvl || 0,
    bagKinds: p0 ? p0.bag.map((b) => b.kind).join(',') : '',
  }))
  const bag = useMemo(
    () => ({
      type: look.bagType,
      colors: look.bagKinds ? look.bagKinds.split(',').map((k) => ITEMS_BY_ID[k]?.color || '#ffffff') : [],
      cap: bagCapacity({ bagType: look.bagType, bagLvl: look.bagLvl }),
    }),
    [look.bagType, look.bagLvl, look.bagKinds],
  )
  const equipped = useMemo(() => parseAvatar(look.avatar), [look.avatar])

  // Their clicks arrive as 'act' messages, which start the swing on this motion.
  useEffect(() => {
    remoteMotions.set(id, motionRef.current)
    return () => remoteMotions.delete(id)
  }, [id])

  useFrame((_st, delta) => {
    const p = getRoom()?.state?.players?.get(id)
    const group = groupRef.current
    if (!p || !group) return

    // Fields can still be unset for a player who has only just joined.
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.z)) return
    _target.set(p.x, p.y - PLAYER_HEIGHT / 2, p.z)
    if (!placed.current) {
      group.position.copy(_target)
      placed.current = true
    } else {
      group.position.lerp(_target, 1 - Math.pow(0.0001, delta))
    }
    if (visualRef.current) {
      const q = visualRef.current.quaternion
      _quat.setFromAxisAngle(_up, Number.isFinite(p.ry) ? p.ry : 0)
      // A NaN rotation would never recover through slerp, and hides the whole body.
      if (!Number.isFinite(q.x + q.y + q.z + q.w)) q.copy(_quat)
      else q.slerp(_quat, 1 - Math.pow(0.001, delta))
    }

    const motion = motionRef.current
    motion.time += delta
    motion.speed = Number.isFinite(p.spd) ? p.spd : 0
    motion.grounded = !p.air

    if (tagRef.current) tagRef.current.textContent = `${fmt(p.strength)}  ·  Lv ${levelInfo(p.strength).level}`

    const bagKinds = p.bag.map((b) => b.kind).join(',')
    if (
      p.pickaxe !== look.pickaxe ||
      p.aura !== look.aura ||
      p.name !== look.name ||
      p.avatar !== look.avatar ||
      p.bagType !== look.bagType ||
      p.bagLvl !== look.bagLvl ||
      bagKinds !== look.bagKinds
    ) {
      setLook({
        pickaxe: p.pickaxe,
        aura: p.aura,
        name: p.name,
        avatar: p.avatar,
        bagType: p.bagType,
        bagLvl: p.bagLvl,
        bagKinds,
      })
    }
  })

  return (
    <group ref={groupRef}>
      <group ref={visualRef}>
        <Character
          motionRef={motionRef}
          height={PLAYER_HEIGHT}
          pickaxe={look.pickaxe}
          aura={look.aura}
          name={look.name}
          tagRef={tagRef}
          bag={bag}
          equipped={equipped}
        />
      </group>
    </group>
  )
})

export function RemotePlayers() {
  const ids = useGame((s) => s.playerIds)
  return ids.map((id) => <RemotePlayer key={id} id={id} />)
}

export default RemotePlayers

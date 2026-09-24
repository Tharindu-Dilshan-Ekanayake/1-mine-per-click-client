import { ITEMS_BY_ID, STAGES, barrierInfo, fmt } from '../shared/gameConfig'
import { spawnDebris, spawnFlight, spawnPop, spawnRing } from './fx'
import { localPlayer } from './localPlayer'
import { sfx, withVolume } from './sound'

/** sessionId -> that remote player's motion state (RemotePlayer registers it). */
export const remoteMotions = new Map()

/** Beyond this distance another player's actions are silent. */
const HEAR_RANGE = 45
/** Half the capsule height: server positions are the capsule centre. */
const HALF_HEIGHT = 0.9

/**
 * Another player did something (the server relays it as an `act` message): show
 * it here too, so the lobby feels alive — their pickaxe chips the floor, pads
 * pulse while they train, jumps kick up dust, loot flies into their bag.
 *
 * Every click arrives as exactly one of swing / hit / break / train, and each of
 * those plays their pickaxe swing.
 *
 * @param {object} m  { id, k: 'swing'|'hit'|'break'|'train'|'jump'|'pick', ... }
 * @param {Map} players  the room's live player map
 */
export function playRemoteAct(m, players) {
  const p = players?.get(m.id)
  if (!p) return
  const d = Math.hypot(p.x - localPlayer.pos.x, p.y - localPlayer.pos.y, p.z - localPlayer.pos.z)
  const volume = Math.max(0, 1 - d / HEAR_RANGE) * 0.7
  const feet = { x: p.x, y: p.y - HALF_HEIGHT, z: p.z }
  const head = { x: p.x, y: p.y + HALF_HEIGHT + 0.9, z: p.z }
  // Where their pickaxe lands: just in front of them.
  const tip = { x: p.x + Math.sin(p.ry) * 0.8, y: feet.y, z: p.z + Math.cos(p.ry) * 0.8 }

  if (m.k === 'swing' || m.k === 'hit' || m.k === 'break' || m.k === 'train') {
    const motion = remoteMotions.get(m.id)
    if (motion) motion.swingT = 0
  }

  switch (m.k) {
    case 'swing':
      withVolume(volume * 0.8, sfx.swing)
      break
    case 'hit': {
      const info = barrierInfo(m.b || 0)
      withVolume(volume, sfx.hit)
      spawnDebris(tip, STAGES[info.stage - 1].floor, 4, 3.2, 0.13)
      break
    }
    case 'break': {
      const info = barrierInfo(m.b || 0)
      const color = STAGES[info.stage - 1].floor
      withVolume(volume, sfx.break)
      for (let i = 0; i < 4; i++) {
        spawnDebris(
          { x: feet.x + (Math.random() - 0.5) * 5, y: feet.y, z: feet.z + (Math.random() - 0.5) * 5 },
          color,
          6,
          5,
          0.28,
        )
      }
      spawnPop(head, 'Floor broken! ⛏', '#ffb400')
      break
    }
    case 'train':
      withVolume(volume * 0.5, sfx.train)
      spawnRing(feet, m.c || '#9aa3ff', 2.6)
      spawnPop(head, `+${fmt(m.v || 0)} 💪`)
      break
    case 'jump':
      withVolume(volume * 0.8, sfx.jump)
      spawnDebris(feet, '#d9c9a8', 5, 1.6, 0.1)
      break
    case 'pick': {
      const def = ITEMS_BY_ID[m.kind]
      withVolume(volume, sfx.pickup)
      if (def) spawnPop(head, `+${def.name}`, '#ffffff')
      // Fly it into their backpack.
      spawnFlight(m.kind, { x: m.x, y: (m.y ?? feet.y) + 0.4, z: m.z }, null, () => {
        const q = players.get(m.id)
        return q ? { x: q.x, y: q.y, z: q.z } : null
      })
      break
    }
    default:
      break
  }
}

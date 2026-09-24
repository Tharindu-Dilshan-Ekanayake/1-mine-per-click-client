import { useEffect, useRef, useState } from 'react'

import { pointGuideAt } from '../game/guide'
import { localPlayer } from '../game/localPlayer'
import { getGame, useGame } from '../net/gameStore'
import { getMe, getRoom, send } from '../net/network'
import {
  BARRIERS_PER_STAGE,
  PICKAXE_BY_ID,
  PIT,
  STALL_RANGE,
  STALLS,
  TRAINING_ZONES,
  TUTORIAL_DONE,
  bagCapacity,
  barrierInfo,
  fmt,
  roomFloorY,
} from '../shared/gameConfig'

const stall = (id) => STALLS.find((s) => s.id === id)
const STONE_COST = PICKAXE_BY_ID.stone.cost
const FEET = 0.9
/** The "You're ready!" card closes by itself after this long. */
const FINISH_AUTO_MS = 15000

/**
 * The first-time guide, step by step. Only brand-new players see it (the server
 * starts veterans at TUTORIAL_DONE); the step is saved, so a reload resumes it.
 * Each step has: what to do, where the arrows point, and when it's done.
 */
const STEPS = [
  {
    title: 'Welcome, miner! 👋',
    text: 'Follow the yellow arrows to the Mine Pit.',
    target: () => ({ x: PIT.x, y: 0, z: PIT.z }),
    done: (me, pos) => Math.abs(pos.x - PIT.x) < PIT.size / 2 && Math.abs(pos.z - PIT.z) < PIT.size / 2 && pos.y > -3,
  },
  {
    title: 'Dig down! ⛏️',
    text: 'Click to swing your pickaxe and break the floor under you. Break 3 floors to reach Stage 1.',
    target: (me) => {
      const b = barrierInfo(Math.min(me.mined, BARRIERS_PER_STAGE - 1))
      return { x: b.x, y: b.topY, z: b.z, path: false }
    },
    progress: (me) => `${Math.min(me.mined, BARRIERS_PER_STAGE)}/${BARRIERS_PER_STAGE} floors`,
    done: (me) => me.mined >= BARRIERS_PER_STAGE,
  },
  {
    title: 'Grab the loot! 💎',
    text: 'Walk up to an item and press E to put it in your backpack. Fill your bag!',
    target: (me, pos) => nearestItem(pos),
    progress: (me) => `${me.bag.length}/${bagCapacity(me)} in bag`,
    done: (me, pos, loc) => me.bag.length >= bagCapacity(me) || (loc.stage === 0 && me.bag.length > 0),
  },
  {
    title: 'Bag full — back to the lobby! 🎒',
    text: 'A full backpack takes you home by itself. (You can also press F or SURFACE any time.)',
    target: () => null,
    done: (me, pos, loc) => loc.stage === 0,
  },
  {
    title: 'Sell your loot 💵',
    text: 'Follow the arrows to the Sell Loot stall and press E to sell everything in your bag.',
    target: () => {
      const s = stall('sell')
      return { x: s.x, y: 0, z: s.z }
    },
    hint: (me) => (me.bag.length === 0 ? 'Your bag is empty — go dig up some loot first!' : null),
    done: () => Boolean(getGame().lastSale),
  },
  {
    title: 'You earned money! 🤑',
    text: 'Money buys better pickaxes, bigger bags and upgrades. Let’s look at the Pickaxes stall.',
    money: true,
    target: () => {
      const s = stall('pickaxes')
      return { x: s.x, y: 0, z: s.z }
    },
    done: (me, pos) => {
      const s = stall('pickaxes')
      return pos.y > -3 && Math.hypot(pos.x - s.x, pos.z - s.z) < STALL_RANGE
    },
  },
  {
    title: 'The Pickaxe shop ⛏️',
    text: 'Press E to look inside. Better pickaxes hit harder and open deeper stages.',
    target: () => {
      const s = stall('pickaxes')
      return { x: s.x, y: 0, z: s.z, path: false }
    },
    done: () => getGame().modal === 'pickaxes',
  },
  {
    title: 'Save up and upgrade! 🎉',
    text: `The Stone Pickaxe costs $${fmt(STONE_COST)}. Keep mining, selling and training on pads until you can afford it!`,
    target: () => {
      const pad = TRAINING_ZONES[0]
      return { x: pad.x, y: 0, z: pad.z }
    },
    finish: true,
    done: () => false,
  },
]

/** The closest loot lying in any room the player is in right now. */
function nearestItem(pos) {
  let best = null
  let bestD = Infinity
  getRoom()?.state?.items?.forEach((it) => {
    const y = roomFloorY(it.stage)
    if (Math.abs(pos.y - FEET - y) > 3) return
    const d = Math.hypot(pos.x - it.x, pos.z - it.z)
    if (d < bestD) {
      bestD = d
      best = { x: it.x, y, z: it.z }
    }
  })
  return best
}

export function Guide() {
  const tut = useGame((s) => s.me?.tut ?? TUTORIAL_DONE)
  const started = useGame((s) => s.started)
  const lastSale = useGame((s) => s.lastSale)
  const [extra, setExtra] = useState({ progress: null, hint: null })
  const sent = useRef(-1)

  const step = STEPS[tut]
  const active = started && step && tut < TUTORIAL_DONE

  // Check the current step a few times a second; advance (and save) when done.
  useEffect(() => {
    if (!active) {
      pointGuideAt(null)
      return
    }
    const check = () => {
      const me = getGame().me
      const live = getMe()
      if (!me || !live) return
      const pos = localPlayer.pos
      const loc = getGame().location
      pointGuideAt(step.target(me, pos))
      setExtra((prev) => {
        const next = { progress: step.progress?.(me) ?? null, hint: step.hint?.(me) ?? null }
        return prev.progress === next.progress && prev.hint === next.hint ? prev : next
      })
      if (step.done(me, pos, loc) && sent.current !== tut + 1) {
        sent.current = tut + 1
        send('tut', { step: tut + 1 })
      }
    }
    check()
    const t = setInterval(check, 250)
    return () => clearInterval(t)
  }, [active, step, tut])

  useEffect(() => () => pointGuideAt(null), [])

  // The last card also closes with Enter (the mouse may be captured), or by itself.
  const isFinish = Boolean(active && step.finish)
  useEffect(() => {
    if (!isFinish) return
    const done = () => {
      pointGuideAt(null)
      send('tut', { step: TUTORIAL_DONE })
    }
    const onKey = (e) => e.code === 'Enter' && done()
    window.addEventListener('keydown', onKey)
    const t = setTimeout(done, FINISH_AUTO_MS)
    return () => {
      window.removeEventListener('keydown', onKey)
      clearTimeout(t)
    }
  }, [isFinish])

  if (!active) return null
  const finish = () => {
    pointGuideAt(null)
    send('tut', { step: TUTORIAL_DONE })
  }

  return (
    <div className="guide">
      <div className="guide-head">
        <span className="guide-step">
          Step {tut + 1} of {STEPS.length}
        </span>
        {!step.finish && (
          <button type="button" className="guide-skip" onClick={finish}>
            Skip guide
          </button>
        )}
      </div>
      <div className="guide-track">
        <div className="guide-track-fill" style={{ width: `${((tut + 1) / STEPS.length) * 100}%` }} />
      </div>
      <div className="guide-title game-text">{step.title}</div>
      {step.money && lastSale && <div className="guide-money">+${fmt(lastSale.total)} from your loot</div>}
      <div className="guide-text">{step.text}</div>
      {extra.progress && <div className="guide-progress">{extra.progress}</div>}
      {extra.hint && <div className="guide-hint">{extra.hint}</div>}
      {step.finish && (
        <button type="button" className="guide-go" onClick={finish}>
          Got it <kbd className="key-badge">Enter</kbd>
        </button>
      )}
    </div>
  )
}

export default Guide

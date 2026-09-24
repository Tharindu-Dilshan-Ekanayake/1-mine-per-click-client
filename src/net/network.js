import { Client } from '@colyseus/sdk'

import { spawnDebris, spawnFlight, spawnRing } from '../game/fx'
import { localPlayer } from '../game/localPlayer'
import { playRemoteAct } from '../game/remoteActs'
import { sfx } from '../game/sound'
import {
  BAG_FULL_RETURN_S,
  ITEMS_BY_ID,
  ROOM_NAME,
  STAGES,
  barrierInfo,
  fmt,
  trainingZoneAt,
} from '../shared/gameConfig'
import { getGame, useGame } from './gameStore'

/**
 * The one Colyseus connection.
 *
 * `joinOrCreate` puts the player into any lobby that still has a free seat; the
 * room caps itself at 8 players, so once a lobby is full the server opens a new
 * one automatically.
 *
 * Where it connects:
 *  - VITE_SERVER_URL set: straight to that server (local dev, or the dev
 *    channel's https://<gameId>.dev.host.bloxity.io).
 *  - otherwise, with VITE_BLOXITY_GAME_ID set: through Bloxity Legion's
 *    matchmaker, which picks a server pod (or starts one) and relays the socket.
 *  - otherwise: port 2567 on the page's own host.
 */

const SERVER_URL = import.meta.env.VITE_SERVER_URL || ''
const GAME_ID = import.meta.env.VITE_BLOXITY_GAME_ID || ''
const MATCHMAKER_URL = (import.meta.env.VITE_MATCHMAKER_URL || 'https://play.bloxity.io').replace(/\/$/, '')
const LOCAL_URL = `${location.protocol}//${location.hostname}:2567`

/** Where the last connection attempt went, for error messages. */
let endpoint = SERVER_URL || (GAME_ID ? MATCHMAKER_URL : LOCAL_URL)

/** A Colyseus client pointed at a live server (asks the matchmaker each time). */
async function makeClient() {
  if (SERVER_URL || !GAME_ID) {
    endpoint = SERVER_URL || LOCAL_URL
    return new Client(endpoint)
  }
  // The matchmaker pins a pod with free seats (starting one if needed) and hands
  // back a relay for it.
  const res = await fetch(`${MATCHMAKER_URL}/v1/play/${encodeURIComponent(GAME_ID)}`, { method: 'POST' })
  if (!res.ok) throw new Error(`matchmaker answered ${res.status}`)
  const { roomId } = await res.json()
  if (!roomId) throw new Error('matchmaker returned no room')
  endpoint = `${MATCHMAKER_URL.replace(/^http/, 'ws')}/v1/ws/${roomId}`
  return new Client(endpoint)
}

/** @type {import('@colyseus/sdk').Room | null} */
let room = null
let joinArgs = null
let retryTimer = null

/** The live room, for per-frame reads inside `useFrame`. */
export const getRoom = () => room

/** Where loot was when we asked to pick it up, so it can fly into the bag. */
export const pendingPickups = new Map()

/** My own Player schema instance (live, mutable), or undefined. */
export const getMe = () => room?.state?.players?.get(room.sessionId)

export function send(type, message) {
  if (room) room.send(type, message)
}

const PLAYER_FIELDS = [
  'name',
  'strength',
  'cash',
  'tokens',
  'bux',
  'bagType',
  'rebirths',
  'mined',
  'best',
  'barrierHp',
  'pickaxe',
  'aura',
  'bagLvl',
  'speedLvl',
  'sellLvl',
  'powerLvl',
  'giftAt',
  'tut',
]

function snapshotPlayer(p) {
  const snap = {}
  for (const key of PLAYER_FIELDS) snap[key] = p[key]
  snap.ownedPickaxes = [...p.ownedPickaxes]
  snap.ownedAuras = [...p.ownedAuras]
  snap.pads = [...p.pads]
  snap.ownedBags = [...p.ownedBags]
  snap.quests = p.quests.map((q) => ({
    type: q.type,
    target: q.target,
    progress: q.progress,
    cash: q.cash,
    tokens: q.tokens,
  }))
  snap.bag = p.bag.map((b) => ({ kind: b.kind, value: b.value }))
  return snap
}

const sameList = (a, b) => a.length === b.length && a.every((v, i) => v === b[i])

let lastMeJson = ''
let lastLeaderboard = ''

function syncState(state) {
  const store = getGame()
  const patch = {}

  const mine = state.players.get(room.sessionId)
  if (mine) {
    const snap = snapshotPlayer(mine)
    const json = JSON.stringify(snap)
    if (json !== lastMeJson) {
      lastMeJson = json
      patch.me = snap
    }
  }

  const others = [...state.players.keys()].filter((id) => id !== room.sessionId)
  if (!sameList(others, store.playerIds)) patch.playerIds = others
  if (state.players.size !== store.playerCount) patch.playerCount = state.players.size

  const items = [...state.items.keys()]
  if (!sameList(items, store.itemIds)) patch.itemIds = items

  if (state.leaderboard && state.leaderboard !== lastLeaderboard) {
    lastLeaderboard = state.leaderboard
    try {
      patch.leaderboard = JSON.parse(state.leaderboard)
    } catch {
      /* keep the previous board */
    }
  }

  const t = store.timers
  if (
    t.legendaryIn !== state.legendaryIn ||
    t.mythicIn !== state.mythicIn ||
    t.secretIn !== state.secretIn
  ) {
    patch.timers = {
      legendaryIn: state.legendaryIn,
      mythicIn: state.mythicIn,
      secretIn: state.secretIn,
    }
  }

  if (Object.keys(patch).length) useGame.setState(patch)
}

function bindRoom(r) {
  r.onStateChange((state) => syncState(state))

  // Other players' actions, for effects (their hits, training, jumps, pickups).
  r.onMessage('act', (m) => playRemoteAct(m, r.state.players))

  r.onMessage('discovered', (list) => useGame.setState({ discovered: list || [] }))

  r.onMessage('clicked', (m) => {
    const store = getGame()
    store.floater(`+${fmt(m.gain)} 💪`)
    if (m.zone) {
      // The pad pulses under your feet with every rep.
      const p = localPlayer.pos
      const zone = trainingZoneAt(p.x, p.y, p.z)
      spawnRing({ x: p.x, y: p.y - 0.9, z: p.z }, zone?.crystal || '#9aa3ff', 2.6)
    }
    if (m.dmg) {
      store.floater(`-${fmt(m.dmg)} ⛏`, '#ff5a5a')
      sfx.hit()
      // Chips fly from where the pickaxe struck (the floor under your feet).
      const k = m.broke !== undefined ? m.broke : getMe()?.mined ?? 0
      const info = barrierInfo(k)
      const p = localPlayer.pos
      spawnDebris({ x: p.x, y: info.topY, z: p.z + 0.4 }, STAGES[info.stage - 1].floor, 5, 3.5, 0.14)
    }
    if (m.broke !== undefined) {
      // The whole floor gives way: boom, rubble everywhere.
      sfx.break()
      const info = barrierInfo(m.broke)
      const color = STAGES[info.stage - 1].floor
      for (let i = 0; i < 7; i++) {
        spawnDebris(
          { x: info.x + (Math.random() - 0.5) * 9, y: info.topY - 0.5, z: info.z + (Math.random() - 0.5) * 9 },
          color,
          7,
          6,
          0.32,
        )
      }
    }
    if (m.newBest) sfx.rare()
    if (m.newBest) {
      store.toast(`🏁 New depth record: Stage ${m.newBest} — ${STAGES[m.newBest - 1]?.name}!`, 'success', 3500)
    } else if (m.broke !== undefined) {
      store.toast('Floor broken! ⛏', 'success', 1400)
    }
  })

  r.onMessage('picked', (m) => {
    const def = ITEMS_BY_ID[m.kind]
    const store = getGame()
    sfx.pickup()
    // Fly the item from where it lay into the backpack.
    const from = pendingPickups.get(m.id)
    pendingPickups.delete(m.id)
    if (from) {
      useGame.setState({ flying: getGame().flying + 1 })
      spawnFlight(m.kind, from, () => {
        sfx.stash()
        useGame.setState({ flying: Math.max(0, getGame().flying - 1) })
      })
    }
    store.floater(`+${def?.name || m.kind}`, '#ffffff')
    if (m.isNew && !store.discovered.includes(m.kind)) {
      useGame.setState({ discovered: [...store.discovered, m.kind] })
      store.toast(`New item discovered: ${def?.name}!`, 'success')
    }
  })

  r.onMessage('sold', (m) => {
    sfx.sell()
    getGame().floater(`+$${fmt(m.total)}`, '#4dff6a')
    getGame().toast(`Sold loot for $${fmt(m.total)}`, 'success')
    useGame.setState({ lastSale: { total: m.total } })
  })

  r.onMessage('rebirthed', (m) => {
    getGame().toast(`Rebirth ${m.rebirths}! Strength boosted.`, 'success', 3500)
    getGame().requestTeleport({ surface: true })
  })

  r.onMessage('gift', (m) => {
    sfx.buy()
    getGame().toast(`🎁 Daily gift: +$${fmt(m.cash)}! Come back tomorrow for another.`, 'success', 3500)
  })

  r.onMessage('bought', (m) => {
    sfx.buy()
    getGame().toast(m.text, 'success')
  })

  r.onMessage('questDone', (m) => {
    sfx.quest()
    getGame().floater(`+$${fmt(m.cash)}`, '#4dff6a')
    getGame().toast(`📜 Quest complete! +$${fmt(m.cash)}${m.tokens ? ` +${m.tokens} 🔄` : ''}`, 'success', 3000)
  })

  // A full backpack sends you home to sell, after a short warning.
  r.onMessage('bagFull', () => startBagReturn())

  r.onMessage('toast', (m) => {
    if (m.kind === 'error') sfx.error()
    getGame().toast(m.text, m.kind)
  })
  r.onMessage('announce', (m) => {
    sfx.rare()
    getGame().toast(`✨ ${m.text}`, `rarity-${m.rarity}`, 6000)
  })

  r.onLeave((code) => {
    if (room !== r) return
    room = null
    lastMeJson = ''
    useGame.setState({ status: 'connecting', error: null, me: null, playerIds: [], itemIds: [] })
    // 1000 / 4000 = a clean, consented leave; anything else is a drop worth retrying.
    if (code !== 1000 && code !== 4000) scheduleRetry()
  })
}

let bagReturnTimer = null

function startBagReturn() {
  if (bagReturnTimer) return
  const store = getGame()
  if (store.location.stage === 0) {
    store.toast('Backpack full! Go sell your loot 💵', 'error', 2500)
    return
  }
  sfx.warn()
  let left = BAG_FULL_RETURN_S
  useGame.setState({ returning: left })
  store.toast(`🎒 Backpack full! Returning to the lobby…`, 'error', BAG_FULL_RETURN_S * 1000)
  bagReturnTimer = setInterval(() => {
    left--
    if (left > 0) {
      useGame.setState({ returning: left })
      return
    }
    clearInterval(bagReturnTimer)
    bagReturnTimer = null
    useGame.setState({ returning: 0 })
    getGame().requestTeleport({ surface: true })
  }, 1000)
}

function scheduleRetry() {
  clearTimeout(retryTimer)
  retryTimer = setTimeout(() => joinArgs && connect(joinArgs), 3000)
}

/**
 * Join (or re-join) a lobby. Calling it again with a different uid - e.g. after
 * logging in - leaves the current lobby first.
 *
 * @param {{ uid: string, name: string, avatar: string }} args
 */
export async function connect(args) {
  joinArgs = args
  clearTimeout(retryTimer)

  if (room) {
    const old = room
    room = null
    try {
      await old.leave(true)
    } catch {
      /* already gone */
    }
  }

  useGame.setState({ status: 'connecting', error: null })
  try {
    const client = await makeClient()
    const r = await client.joinOrCreate(ROOM_NAME, args)
    if (joinArgs !== args) {
      // A newer connect() started while this one was in flight.
      r.leave(true)
      return
    }
    room = r
    lastMeJson = ''
    lastLeaderboard = ''
    bindRoom(r)
    useGame.setState({ status: 'connected', roomId: r.roomId, sessionId: r.sessionId })
  } catch (err) {
    console.error('[net] join failed', err)
    useGame.setState({
      status: 'error',
      error: `Can't reach the game server at ${endpoint}. Retrying…`,
    })
    scheduleRetry()
  }
}

export function disconnect() {
  joinArgs = null
  clearTimeout(retryTimer)
  room?.leave(true)
  room = null
}

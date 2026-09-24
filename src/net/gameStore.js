import { create } from 'zustand'

/**
 * Everything the HUD needs from the multiplayer session, as plain objects.
 *
 * The Colyseus state itself lives on the room (see `network.js`) and the 3D scene
 * reads it directly inside `useFrame`. This store only holds snapshots that React
 * UI renders from, so a position update 20x a second never re-renders the HUD.
 */

let toastSeq = 0

export const useGame = create((set, get) => ({
  /** @type {'idle'|'connecting'|'connected'|'error'} */
  status: 'idle',
  error: null,
  roomId: '',
  sessionId: '',
  playerCount: 0,

  /** Snapshot of my own Player schema, or null before joining. */
  me: null,
  /** Session ids of everyone else in the lobby. */
  playerIds: [],
  /** Ids of loot items currently lying in the mine. */
  itemIds: [],
  leaderboard: { strength: [], cash: [], rebirths: [] },
  timers: { legendaryIn: 0, mythicIn: 0, secretIn: 0 },
  /** Item kinds this player has ever picked up (for the Index). */
  discovered: [],

  /** Where the local player is: { stage, zone, barrier } — written by Player. */
  location: { stage: 0, zoneMult: 0, zoneLocked: false, onBarrier: false, needPick: null },
  /** Nearby interaction, or null: { key, label, kind, id } */
  prompt: null,
  /** Which modal is open: null | 'pickaxes' | 'auras' | 'upgrades' | 'rebirth' | 'index' */
  modal: null,

  toasts: [],
  floaters: [],

  /** Seconds left before a full backpack auto-returns you (0 = not returning). */
  returning: 0,
  /** Loot items mid-flight into the backpack (not shown inside it yet). */
  flying: 0,

  /** Loading milestones, for the loading screen. */
  sceneReady: false,
  avatarReady: false,
  /** The loading screen is done and the player is in the lobby. */
  started: false,

  /** The most recent sale this session, { total } (the guide shows it). */
  lastSale: null,

  /** Pending teleport for the local physics body, consumed by Player. */
  teleport: null,

  setModal: (modal) => set({ modal }),
  requestTeleport: (pos) => set({ teleport: { ...pos, seq: Date.now() } }),

  toast: (text, kind = 'info', ms = 2600) => {
    const id = ++toastSeq
    set({ toasts: [...get().toasts, { id, text, kind }].slice(-4) })
    setTimeout(() => set({ toasts: get().toasts.filter((t) => t.id !== id) }), ms)
  },

  floater: (text, color = '#ffe14d') => {
    const id = ++toastSeq
    const x = 44 + Math.random() * 12
    set({ floaters: [...get().floaters, { id, text, color, x }].slice(-8) })
    setTimeout(() => set({ floaters: get().floaters.filter((f) => f.id !== id) }), 1100)
  },
}))

export const getGame = () => useGame.getState()

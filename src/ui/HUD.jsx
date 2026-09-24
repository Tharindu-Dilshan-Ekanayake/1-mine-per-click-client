import { useEffect, useState } from 'react'

import { interact } from '../game/interact'
import { isMuted, onMuteChange, setMuted, sfx } from '../game/sound'
import { lockPointer } from '../game/view'
import { getGame, useGame } from '../net/gameStore'
import { send } from '../net/network'
import {
  BARRIERS_PER_STAGE,
  QUEST_TYPES,
  STAGES,
  bagCapacity,
  barrierInfo,
  fmt,
  hitDamage,
  levelInfo,
  rebirthCost,
  strengthPerClick,
} from '../shared/gameConfig'
import Guide from './Guide'
import { PickaxeIcon } from './icons'

/** Little keyboard-key badge shown on a button, e.g. [P]. */
export function KeyBadge({ k }) {
  return <kbd className="key-badge">{k}</kbd>
}

/** Opens a menu, or closes it if it's already the one open. */
const toggleModal = (id) => {
  const { modal, setModal } = getGame()
  setModal(modal === id ? null : id)
}

/**
 * Keyboard shortcuts for every HUD button (shown as badges on the buttons).
 * Movement keys (WASD, Space, Shift) and E are handled by the player.
 */
const SHORTCUTS = {
  KeyP: () => toggleModal('pickaxes'),
  KeyB: () => toggleModal('bags'),
  KeyT: () => toggleModal('auras'),
  KeyU: () => toggleModal('upgrades'),
  KeyR: () => toggleModal('rebirth'),
  KeyI: () => toggleModal('index'),
  KeyG: () => send('gift'),
  KeyQ: () => useGame.setState({ questsOpen: !(getGame().questsOpen ?? true) }),
  KeyM: () => setMuted(!isMuted()),
  KeyF: () => {
    if (getGame().location.stage > 0) getGame().requestTeleport({ surface: true })
  },
}

function Hotkeys() {
  useEffect(() => {
    const onKey = (e) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (!getGame().started) return
      const action = SHORTCUTS[e.code]
      if (!action) return
      e.preventDefault()
      action()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  return null
}

function MenuTile({ label, icon, className, badge, hotkey, onClick }) {
  return (
    <button type="button" className={`menu-tile ${className}`} onClick={onClick}>
      {hotkey && <KeyBadge k={hotkey} />}
      <span className="menu-tile-icon">{icon}</span>
      <span className="menu-tile-label game-text">{label}</span>
      {badge && <span className="menu-tile-badge game-text">{badge}</span>}
    </button>
  )
}

function LeftMenu({ me }) {
  const setModal = useGame((s) => s.setModal)
  const pct = me ? Math.min(100, Math.floor((me.cash / rebirthCost(me.rebirths)) * 100)) : 0
  return (
    <div className="left-menu">
      <div className="menu-grid">
        <MenuTile label="Bags" icon="🎒" className="tile-shop" hotkey="B" onClick={() => setModal('bags')} />
        <MenuTile label="Pickaxe" icon="⛏️" className="tile-pickaxe" hotkey="P" onClick={() => setModal('pickaxes')} />
        <MenuTile label="Index" icon="📘" className="tile-index" hotkey="I" onClick={() => setModal('index')} />
        <MenuTile
          label="Rebirth"
          icon="🔄"
          className="tile-rebirth"
          hotkey="R"
          badge={`${pct}%`}
          onClick={() => setModal('rebirth')}
        />
      </div>
      <button type="button" className="upgrades-btn auras-btn game-text" onClick={() => setModal('auras')}>
        <KeyBadge k="T" /> AURAS
      </button>
      <button type="button" className="upgrades-btn game-text" onClick={() => setModal('upgrades')}>
        <KeyBadge k="U" /> UPGRADES
      </button>
    </div>
  )
}

function Stats({ me }) {
  const cap = me ? bagCapacity(me) : 3
  const bag = me?.bag.length ?? 0
  return (
    <div className="stats">
      <div className={`stat-row ${bag >= cap ? 'stat-full' : ''}`}>
        <span className="stat-icon">🎒</span>
        <span className="game-text stat-value">
          {bag}/{cap}
        </span>
      </div>
      <div className="stat-row">
        <span className="stat-icon">🔄</span>
        <span className="game-text stat-value">{fmt(me?.tokens ?? 0)}</span>
      </div>
      <div className="stat-row">
        <span className="stat-icon">💵</span>
        <span className="game-text stat-value stat-cash">${fmt(me?.cash ?? 0)}</span>
      </div>
    </div>
  )
}

/** "Level 2 ▓▓░░ 4/49" at the very top, like the screenshots. Pops on level-up. */
function LevelBar({ me }) {
  const { level, into, span } = levelInfo(me?.strength ?? 0)
  const [pop, setPop] = useState(false)
  const [lastLevel, setLastLevel] = useState(level)

  // Level-up feedback: adjust state during render when the level changes.
  if (me && level !== lastLevel) {
    setLastLevel(level)
    if (level > lastLevel) setPop(true)
  }
  useEffect(() => {
    if (!pop) return
    sfx.levelUp()
    getGame().toast(`⭐ Level Up! You are now Level ${level}`, 'success', 2200)
    const t = setTimeout(() => setPop(false), 700)
    return () => clearTimeout(t)
  }, [pop, level])

  return (
    <div className={`xp-bar ${pop ? 'pop' : ''}`}>
      <div className="xp-bar-icon">💪</div>
      <div className="xp-bar-track">
        <div className="xp-bar-fill" style={{ width: `${Math.min(100, (into / span) * 100)}%` }} />
        <span className="game-text xp-bar-level">Level {level}</span>
        <span className="game-text xp-bar-count">
          {fmt(into)}/{fmt(span)}
        </span>
      </div>
    </div>
  )
}

/** Top-centre stack: level bar, then the objective ("Start Mining" / SURFACE), then the dig bar. */
function TopBanner({ me }) {
  const location = useGame((s) => s.location)
  const requestTeleport = useGame((s) => s.requestTeleport)

  let objective
  if (location.stage > 0) {
    const stage = STAGES[location.stage - 1]
    objective = (
      <>
        <button type="button" className="surface-btn game-text" onClick={() => requestTeleport({ surface: true })}>
          <KeyBadge k="F" /> SURFACE
        </button>
        <div className="stage-chip game-text">
          Stage {location.stage} · {stage?.name}
        </div>
      </>
    )
  } else {
    let text = 'Start Mining ⛏'
    if (me && me.bag.length >= bagCapacity(me)) text = 'Sell your Loot!'
    else if (location.zoneMult) text = 'Training Area'
    objective = <div className="top-banner game-text">{text}</div>
  }

  const returning = useGame((s) => s.returning)
  if (returning > 0) {
    objective = <div className="top-banner game-text returning">🎒 Bag full! Lobby in {returning}…</div>
  }

  return (
    <div className="top-banner-wrap">
      <LevelBar me={me} />
      {objective}
      <BarrierBar me={me} />
      <Guide />
    </div>
  )
}

/** HP bar for the floor you're standing on and digging through. */
function BarrierBar({ me }) {
  const onBarrier = useGame((s) => s.location.onBarrier)
  const needPick = useGame((s) => s.location.needPick)
  if (!me || !onBarrier || me.mined >= STAGES.length * BARRIERS_PER_STAGE) return null
  const b = barrierInfo(me.mined)
  const hp = Math.max(0, me.barrierHp)
  return (
    <div className="level-bar">
      <div className="level-bar-icon">⛏️</div>
      <div className="level-bar-track">
        <div className="level-bar-fill" style={{ width: `${(hp / b.hp) * 100}%` }} />
        <span className="game-text level-bar-left">
          Stage {b.stage} · Floor {b.layer + 1}/{BARRIERS_PER_STAGE}
        </span>
        <span className="game-text level-bar-right">
          {fmt(hp)}/{fmt(b.hp)}
        </span>
      </div>
      {needPick && <div className="game-text need-pick">🔒 Needs {needPick} Pickaxe — buy it at the Pickaxes stall</div>}
    </div>
  )
}

function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(t)
  }, [ms])
  return now
}

/** Seconds until the next daily gift, as h:mm:ss (or m:ss under an hour). */
function giftCountdown(s) {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = String(s % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`
}

function RightPanel({ me }) {
  const location = useGame((s) => s.location)
  const now = useNow()
  if (!me) return null
  const zone = location.zoneMult && !location.zoneLocked ? { mult: location.zoneMult } : null
  const perClick = strengthPerClick(me, zone)
  const giftIn = Math.max(0, Math.ceil((me.giftAt - now) / 1000))

  return (
    <div className="right-panel">
      <div className="power-card">
        <div className="game-text power-value">💪 {fmt(me.strength)}</div>
        <div className="game-text power-sub">+{fmt(perClick)} / click</div>
        <div className="game-text power-sub power-dmg">⛏ {fmt(hitDamage(me))} dmg / hit</div>
        {location.zoneMult > 0 && (
          <div className={`game-text zone-badge ${location.zoneLocked ? 'locked' : ''}`}>
            {location.zoneLocked ? '🔒 Press E to unlock ' : '⚡ Auto-training '}x{fmt(location.zoneMult)}
          </div>
        )}
      </div>
      <Quests me={me} />
      <button
        type="button"
        className={`gift-btn ${giftIn === 0 ? 'ready' : ''}`}
        onClick={() => send('gift')}
        disabled={giftIn > 0}
      >
        <KeyBadge k="G" />
        <span className="gift-icon">🎁</span>
        <span className="game-text gift-label">
          {giftIn === 0 ? 'FREE' : giftCountdown(giftIn)}
        </span>
      </button>
    </div>
  )
}

/** Three rotating quests with progress bars; finished ones can be claimed. */
function Quests({ me }) {
  const open = useGame((s) => s.questsOpen ?? true)
  const setOpen = (v) => useGame.setState({ questsOpen: v })
  const ready = me.quests.filter((q) => q.progress >= q.target).length
  return (
    <div className="quests">
      <button type="button" className="quests-head game-text" onClick={() => setOpen(!open)}>
        <KeyBadge k="Q" /> 📜 Quests {ready > 0 && <span className="quests-ready">{ready}</span>}
        <span className="quests-toggle">{open ? '▾' : '▸'}</span>
      </button>
      {open &&
        me.quests.map((q, i) => {
          const def = QUEST_TYPES[q.type]
          const done = q.progress >= q.target
          const pct = Math.min(100, (q.progress / q.target) * 100)
          return (
            <div key={`${i}-${q.type}`} className={`quest ${done ? 'done' : ''}`}>
              <div className="quest-title">
                {def?.icon} {def?.label(q.target)}
              </div>
              <div className="quest-bar">
                <div className="quest-fill" style={{ width: `${pct}%` }} />
                <span>
                  {q.type === 'sell' ? `${fmt(q.progress)}` : fmt(q.progress)} / {q.type === 'sell' ? `${fmt(q.target)}` : fmt(q.target)}
                </span>
              </div>
              <div className="quest-foot">
                <span className="quest-reward">
                  +${fmt(q.cash)}
                  {q.tokens ? ` +${q.tokens} 🔄` : ''}
                </span>
                {done && (
                  <button type="button" className="quest-claim game-text" onClick={() => send('claimQuest', { i })}>
                    CLAIM
                  </button>
                )}
              </div>
            </div>
          )
        })}
    </div>
  )
}

function Hotbar({ me }) {
  return (
    <div className="hotbar">
      <div className="hotbar-slot active">
        <span className="hotbar-num game-text">1</span>
        <PickaxeIcon id={me?.pickaxe} size={52} />
      </div>
    </div>
  )
}

function Prompt() {
  const prompt = useGame((s) => s.prompt)
  const modal = useGame((s) => s.modal)
  if (!prompt || modal) return null
  return (
    <button type="button" className="prompt" onClick={interact}>
      <span className="prompt-key">E</span>
      <span className="game-text prompt-label">{prompt.label}</span>
    </button>
  )
}

function Toasts() {
  const toasts = useGame((s) => s.toasts)
  return (
    <div className="toasts">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.kind} game-text`}>
          {t.text}
        </div>
      ))}
    </div>
  )
}

function Floaters() {
  const floaters = useGame((s) => s.floaters)
  return floaters.map((f) => (
    <div key={f.id} className="floater game-text" style={{ left: `${f.x}%`, color: f.color }}>
      {f.text}
    </div>
  ))
}

function MuteButton() {
  const [muted, setMutedState] = useState(isMuted())
  useEffect(() => onMuteChange(setMutedState), [])
  return (
    <button type="button" className="mute-btn" onClick={() => setMuted(!muted)} title={muted ? 'Unmute' : 'Mute'}>
      <KeyBadge k="M" />
      <span className="mute-icon">{muted ? '🔇' : '🔊'}</span>
      <span className="game-text mute-label">{muted ? 'Sound off' : 'Sound on'}</span>
    </button>
  )
}

/** "Click to play" reminder while the mouse is free (after Esc) and no menu is open. */
function MouseHint() {
  const started = useGame((s) => s.started)
  const locked = useGame((s) => s.locked)
  const modal = useGame((s) => s.modal)
  if (!started || locked || modal) return null
  return (
    <button type="button" className="mouse-hint game-text" onClick={lockPointer}>
      🖱 Click the game to look around · <KeyBadge k="Esc" /> frees the mouse
    </button>
  )
}

export function HUD() {
  const me = useGame((s) => s.me)
  return (
    <div className="hud">
      <TopBanner me={me} />
      <LeftMenu me={me} />
      <Stats me={me} />
      <RightPanel me={me} />
      <Hotbar me={me} />
      <Prompt />
      <Toasts />
      <Floaters />
      <MuteButton />
      <MouseHint />
      <Hotkeys />
    </div>
  )
}

export default HUD

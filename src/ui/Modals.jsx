import { useEffect } from 'react'

import { RarityText } from '../game/Items'
import { localPlayer } from '../game/localPlayer'
import { useGame } from '../net/gameStore'
import { send } from '../net/network'
import {
  AURAS,
  BAGS,
  EVENT_ITEMS,
  PICKAXES,
  RARITIES,
  STAGES,
  STALL_RANGE,
  STALLS,
  UPGRADES,
  bagCapacity,
  completedStages,
  fmt,
  pickaxeOpensStage,
  powerMult,
  rebirthCost,
  rebirthMult,
  rebirthTokens,
  sellMult,
  speedMult,
  upgradeCost,
} from '../shared/gameConfig'
import { ItemIcon, PickaxeIcon } from './icons'

/**
 * Shops only sell in person: true when the player stands at that stall in the
 * lobby (the server checks the same). Menus opened anywhere else are browse-only.
 * The player can't move while a menu is open, so reading the position once per
 * render is enough.
 */
function atStall(stallId) {
  const stall = STALLS.find((s) => s.id === stallId)
  const p = localPlayer.pos
  return Boolean(stall) && p.y > -3 && Math.hypot(p.x - stall.x, p.z - stall.z) <= STALL_RANGE + 2
}

/** Banner for a browse-only shop, pointing at the stall that sells it. */
function StallNote({ stallId }) {
  if (atStall(stallId)) return null
  const stall = STALLS.find((s) => s.id === stallId)
  return (
    <div className="stall-note game-text">
      📍 Browsing only — go to the {stall?.icon} {stall?.label} stall in the lobby to buy
    </div>
  )
}

function Modal({ title, icon, children, tabs }) {
  const setModal = useGame((s) => s.setModal)

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && setModal(null)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setModal])

  return (
    <div className="modal-backdrop" onPointerDown={(e) => e.target === e.currentTarget && setModal(null)}>
      <div className="modal">
        <div className="modal-header">
          <span className="modal-icon">{icon}</span>
          <span className="game-text modal-title">{title}</span>
          <button type="button" className="modal-close game-text" onClick={() => setModal(null)}>
            X
          </button>
        </div>
        {tabs}
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}

function ShopTabs({ active }) {
  const setModal = useGame((s) => s.setModal)
  return (
    <div className="modal-tabs">
      {[
        ['pickaxes', '⛏️ Pickaxes', 'P'],
        ['auras', '🔥 Auras', 'T'],
        ['bags', '🎒 Bags', 'B'],
      ].map(([id, label, key]) => (
        <button
          key={id}
          type="button"
          className={`modal-tab game-text ${active === id ? 'active' : ''}`}
          onClick={() => setModal(id)}
        >
          <kbd className="key-badge">{key}</kbd> {label}
        </button>
      ))}
    </div>
  )
}

function rarityClass(rarity) {
  return `row-${rarity.toLowerCase()}`
}

/** Deepest stage this pickaxe can dig (the stage before the next pickaxe gate). */
function nextGate(id) {
  const i = PICKAXES.findIndex((p) => p.id === id)
  for (let j = i + 1; j < PICKAXES.length; j++) {
    const s = pickaxeOpensStage(PICKAXES[j].id)
    if (s) return s - 1
  }
  return STAGES.length
}

/** Guide step (see ui/Guide.jsx) that shows off the Pickaxes shop. */
const GUIDE_BUY_STEP = 6

function PickaxesModal({ me }) {
  const canBuy = atStall('pickaxes')
  return (
    <Modal title="Pickaxes" icon="⛏️" tabs={<ShopTabs active="pickaxes" />}>
      <StallNote stallId="pickaxes" />
      {PICKAXES.map((p) => {
        const owned = me.ownedPickaxes.includes(p.id)
        const equipped = me.pickaxe === p.id
        // The guide's pickaxe-shop step points at this one as the next goal.
        const guided = me.tut === GUIDE_BUY_STEP && p.id === 'stone' && !owned
        return (
          <div key={p.id} className={`shop-row ${rarityClass(p.rarity)} ${guided ? 'tut-glow' : ''}`}>
            <div className="shop-icon">
              <PickaxeIcon id={p.id} size={64} />
            </div>
            <div className="shop-info">
              <div className="game-text shop-name">{p.name}</div>
              <div className="game-text shop-rarity">
                <RarityText rarity={p.rarity} />
              </div>
              <div className="game-text shop-stat">
                ⛏ {fmt(p.dmg)} dmg · 💪 +{fmt(p.power)}
              </div>
              {pickaxeOpensStage(p.id) && <div className="shop-opens">⛏ Digs up to Stage {nextGate(p.id)}</div>}
            </div>
            <div className="shop-actions">
              {equipped ? (
                <button type="button" className="btn btn-green game-text" disabled>
                  Equipped
                </button>
              ) : owned ? (
                <button type="button" className="btn btn-blue game-text" onClick={() => send('equipPickaxe', { id: p.id })}>
                  Equip
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-green game-text"
                  disabled={!canBuy || me.cash < p.cost}
                  onClick={() => send('buyPickaxe', { id: p.id })}
                >
                  ${fmt(p.cost)}
                </button>
              )}
            </div>
          </div>
        )
      })}
    </Modal>
  )
}

function AurasModal({ me }) {
  const canBuy = atStall('auras')
  return (
    <Modal title="Auras" icon="🔥" tabs={<ShopTabs active="auras" />}>
      <StallNote stallId="auras" />
      <div className="modal-note">Auras multiply every click. Buy them with 🔄 rebirth tokens.</div>
      {AURAS.map((a) => {
        const owned = me.ownedAuras.includes(a.id)
        const equipped = me.aura === a.id
        return (
          <div key={a.id} className="shop-row">
            <div className="shop-icon">
              <div className="aura-swatch" style={{ background: a.color, boxShadow: `0 0 24px ${a.color}` }} />
            </div>
            <div className="shop-info">
              <div className="game-text shop-name">{a.name}</div>
              <div className="game-text shop-stat">x{a.mult} Strength</div>
            </div>
            <div className="shop-actions">
              {equipped ? (
                <button type="button" className="btn btn-green game-text" disabled>
                  Equipped
                </button>
              ) : owned ? (
                <button type="button" className="btn btn-blue game-text" onClick={() => send('equipAura', { id: a.id })}>
                  Equip
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-purple game-text"
                  disabled={!canBuy || me.tokens < a.cost}
                  onClick={() => send('buyAura', { id: a.id })}
                >
                  🔄 {a.cost}
                </button>
              )}
            </div>
          </div>
        )
      })}
    </Modal>
  )
}

/** Blocky backpack icon in the bag's own colours. */
function BagIcon({ bag }) {
  return (
    <div className="bag-icon" style={{ '--body': bag.body, '--trim': bag.trim, '--accent': bag.accent }}>
      <span className="bag-flap" />
      <span className="bag-pocket" />
      <span className="bag-buckle" />
    </div>
  )
}

function BagsModal({ me }) {
  const canBuy = atStall('pickaxes')
  return (
    <Modal title="Backpacks" icon="🎒" tabs={<ShopTabs active="bags" />}>
      <StallNote stallId="pickaxes" />
      <div className="modal-note">
        Bigger backpacks carry more loot per trip. Extra Pockets upgrades add slots to any bag. 💠 Bux bags
        are premium: Bux can only be bought, not earned in the game. You have 💠 {fmt(me.bux)}.
      </div>
      {BAGS.map((b) => {
        const owned = me.ownedBags.includes(b.id)
        const equipped = me.bagType === b.id
        const price = b.bux ? `💠 ${fmt(b.bux)}` : `$${fmt(b.cost)}`
        const affordable = b.bux ? me.bux >= b.bux : me.cash >= b.cost
        return (
          <div key={b.id} className={`shop-row ${b.bux ? 'row-premium' : ''}`}>
            <div className="shop-icon">
              <BagIcon bag={b} />
            </div>
            <div className="shop-info">
              <div className="game-text shop-name">{b.name}</div>
              <div className="game-text shop-stat">🎒 {b.cap} slots</div>
            </div>
            <div className="shop-actions">
              {equipped ? (
                <button type="button" className="btn btn-green game-text" disabled>
                  Equipped
                </button>
              ) : owned ? (
                <button type="button" className="btn btn-blue game-text" onClick={() => send('equipBag', { id: b.id })}>
                  Equip
                </button>
              ) : (
                <button
                  type="button"
                  className={`btn ${b.bux ? 'btn-purple' : 'btn-green'} game-text`}
                  disabled={!canBuy || !affordable}
                  onClick={() => send('buyBag', { id: b.id })}
                >
                  {price}
                </button>
              )}
            </div>
          </div>
        )
      })}
    </Modal>
  )
}

const UPGRADE_EFFECT = {
  bag: (lvl, me) => `+${lvl} slots (${bagCapacity({ bagType: me.bagType, bagLvl: lvl })} total)`,
  speed: (lvl) => `x${speedMult(lvl).toFixed(2)} speed`,
  sell: (lvl) => `x${sellMult(lvl).toFixed(2)} value`,
  power: (lvl) => `x${powerMult(lvl).toFixed(1)} strength`,
}

function UpgradesModal({ me }) {
  const canBuy = atStall('upgrades')
  return (
    <Modal title="Upgrades" icon="⬆️">
      <StallNote stallId="upgrades" />
      {Object.entries(UPGRADES).map(([key, u]) => {
        const lvl = me[`${key}Lvl`]
        const maxed = lvl >= u.max
        const cost = upgradeCost(key, lvl)
        return (
          <div key={key} className="shop-row">
            <div className="shop-icon emoji-icon">{u.icon}</div>
            <div className="shop-info">
              <div className="game-text shop-name">{u.name}</div>
              <div className="shop-desc">
                {u.desc} · now {UPGRADE_EFFECT[key](lvl, me)}
              </div>
              <div className="lvl-pips">
                {Array.from({ length: u.max }, (_, i) => (
                  <span key={i} className={i < lvl ? 'on' : ''} />
                ))}
              </div>
            </div>
            <div className="shop-actions">
              <button
                type="button"
                className="btn btn-green game-text"
                disabled={maxed || !canBuy || me.cash < cost}
                onClick={() => send('upgrade', { key })}
              >
                {maxed ? 'MAX' : `$${fmt(cost)}`}
              </button>
            </div>
          </div>
        )
      })}
    </Modal>
  )
}

function RebirthModal({ me }) {
  const cost = rebirthCost(me.rebirths)
  const pct = Math.min(100, (me.cash / cost) * 100)
  return (
    <Modal title="Rebirth" icon="🔄">
      <div className="rebirth-card">
        <div className="game-text rebirth-now">Rebirths: {me.rebirths}</div>
        <div className="rebirth-grid">
          <div>
            <div className="rebirth-label">Strength multiplier</div>
            <div className="game-text rebirth-val">
              x{rebirthMult(me.rebirths)} → <span className="good">x{rebirthMult(me.rebirths + 1)}</span>
            </div>
          </div>
          <div>
            <div className="rebirth-label">Reward</div>
            <div className="game-text rebirth-val">
              <span className="good">+{rebirthTokens(me.rebirths)} 🔄 tokens</span>
            </div>
          </div>
        </div>
        <div className="rebirth-warn">
          Resets your cash, strength, backpack and mine progress. Pickaxes, auras and upgrades are kept. More
          rebirths unlock stronger training rocks.
        </div>
        <div className="progress">
          <div className="progress-fill" style={{ width: `${pct}%` }} />
          <span className="game-text">
            ${fmt(me.cash)} / ${fmt(cost)}
          </span>
        </div>
        <button
          type="button"
          className="btn btn-pink game-text big"
          disabled={me.cash < cost}
          onClick={() => {
            send('rebirth')
            useGame.getState().setModal(null)
          }}
        >
          REBIRTH
        </button>
      </div>
    </Modal>
  )
}

function IndexModal() {
  const discovered = useGame((s) => s.discovered)
  const found = new Set(discovered)
  const groups = [
    ...STAGES.map((s, i) => ({ title: `Stage ${i + 1} · ${s.name}`, items: s.items })),
    {
      title: 'World Events',
      items: Object.values(EVENT_ITEMS).flatMap((e) => e.items),
    },
  ]
  const total = groups.reduce((n, g) => n + g.items.length, 0)
  return (
    <Modal title="Index" icon="📘">
      <div className="modal-note">
        Discovered {found.size} / {total} items
      </div>
      <div className="index-bonus">
        ⭐ Completed stages: {completedStages(found)} / {STAGES.length} — sell bonus +{completedStages(found) * 10}%
        <br />
        <small>Collect every item from a stage for a permanent +10% on everything you sell.</small>
      </div>
      {groups.map((g) => (
        <div key={g.title} className="index-group">
          <div className="game-text index-title">{g.title}</div>
          <div className="index-grid">
            {g.items.map((it) => {
              const known = found.has(it.id)
              return (
                <div key={it.id} className="index-card" title={known ? it.name : '???'}>
                  <ItemIcon def={it} size={52} hidden={!known} />
                  <div className="index-name">{known ? it.name : '???'}</div>
                  <div className="index-rarity" style={{ color: RARITIES[it.rarity].color === 'rainbow' ? undefined : RARITIES[it.rarity].color }}>
                    <RarityText rarity={it.rarity} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </Modal>
  )
}

export function Modals() {
  const modal = useGame((s) => s.modal)
  const me = useGame((s) => s.me)
  if (!modal) return null
  if (modal === 'index') return <IndexModal />
  if (!me) return null
  switch (modal) {
    case 'pickaxes':
      return <PickaxesModal me={me} />
    case 'auras':
      return <AurasModal me={me} />
    case 'bags':
      return <BagsModal me={me} />
    case 'upgrades':
      return <UpgradesModal me={me} />
    case 'rebirth':
      return <RebirthModal me={me} />
    default:
      return null
  }
}

export default Modals

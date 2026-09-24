import { PICKAXE_BY_ID, PICKAXES } from '../shared/gameConfig'

/** A flat pickaxe icon tinted to match the in-game pickaxe. */
export function PickaxeIcon({ id = 'wood', size = 48 }) {
  const def = PICKAXE_BY_ID[id] || PICKAXES[0]
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect x="28" y="14" width="8" height="46" rx="2" fill={def.handle} stroke="#111" strokeWidth="3" />
      <path
        d="M6 22 Q32 2 58 22 L52 26 Q32 14 12 26 Z"
        fill={def.head}
        stroke="#111"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <rect x="26" y="10" width="12" height="12" rx="2" fill={def.head} stroke="#111" strokeWidth="3" />
    </svg>
  )
}

const SHAPE_EMOJI = {
  ore: '🪨',
  gem: '💎',
  bar: '🧈',
  duck: '🦆',
  orb: '🔮',
  crate: '📦',
  skull: '💀',
}

/** Loot icon for the Index and backpack. */
export function ItemIcon({ def, size = 44, hidden = false }) {
  return (
    <div
      className="item-icon"
      style={{
        width: size,
        height: size,
        background: hidden ? '#2b2f45' : def.color,
        fontSize: size * 0.55,
      }}
    >
      <span style={{ filter: hidden ? 'brightness(0)' : undefined }}>
        {SHAPE_EMOJI[def.shape] || '🪨'}
      </span>
    </div>
  )
}

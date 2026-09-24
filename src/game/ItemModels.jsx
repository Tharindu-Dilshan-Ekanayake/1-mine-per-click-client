import { Sparkles } from '@react-three/drei'

import {
  crystalGeo,
  diamondGeo,
  gemMat,
  glassMat,
  glowMat,
  ingotGeo,
  matteMat,
  metalMat,
  plasticMat,
  rockGeo,
  stoneMat,
} from './itemMaterials'
import { TIERS, useQuality } from './quality'

/**
 * Loot models. Each item's `shape` picks a model family and its `id` can pick a
 * special case (cash, coal, crowns...). All models sit on y = 0 and are ~1 unit big.
 */

const HIGH_RARITY = new Set(['Rare', 'Epic', 'Legendary', 'Mythic', 'Secret', 'Divine'])
const SPARKLE_RARITY = new Set(['Epic', 'Legendary', 'Mythic', 'Secret', 'Divine'])

/** Items that are the rock itself, rather than ore embedded in rock. */
const PLAIN_ROCKS = new Set(['rock', 'coal', 'basalt', 'voidstone', 'chaosrock', 'flint', 'gummy'])
const SHINY_ROCKS = new Set(['coal', 'basalt', 'voidstone'])

/** Brilliant-cut diamond, tilted so the facets catch the light. */
function Diamond({ color }) {
  return (
    <group position={[0, 0.55, 0]} rotation={[0.35, 0, 0.2]}>
      <mesh geometry={diamondGeo()} material={gemMat(color)} castShadow />
    </group>
  )
}

/** A cluster of hex crystals growing out of a small rock. */
function CrystalCluster({ color, base = '#6f7388' }) {
  const shards = [
    [0, 0, 0, 1.15],
    [0.2, 0.05, 0.6, 0.8],
    [-0.2, -0.1, -0.5, 0.75],
    [0.05, 0.22, 0.4, 0.6],
    [-0.08, -0.25, -0.35, 0.65],
  ]
  return (
    <group>
      <mesh geometry={rockGeo()} material={stoneMat(base)} scale={[0.75, 0.45, 0.75]} position={[0, 0.12, 0]} castShadow />
      {shards.map(([x, z, tilt, s], i) => (
        <mesh
          key={i}
          geometry={crystalGeo()}
          material={gemMat(color)}
          position={[x, 0.15, z]}
          rotation={[tilt * 0.6, i * 1.3, -tilt]}
          scale={s}
          castShadow
        />
      ))}
    </group>
  )
}

/** Ore: a grey rock with glowing crystal veins poking out. */
function Ore({ id, color }) {
  if (PLAIN_ROCKS.has(id)) {
    return (
      <mesh
        geometry={rockGeo()}
        material={stoneMat(color, SHINY_ROCKS.has(id))}
        position={[0, 0.32, 0]}
        castShadow
      />
    )
  }
  const veins = [
    [0.25, 0.45, 0.12, 0.7, 0.9],
    [-0.28, 0.4, 0.05, -0.8, 0.8],
    [0.02, 0.55, -0.25, 0.2, 0.7],
    [0.05, 0.5, 0.3, -0.3, 0.6],
  ]
  return (
    <group>
      <mesh geometry={rockGeo()} material={stoneMat('#7a7d92')} position={[0, 0.32, 0]} castShadow />
      {veins.map(([x, y, z, tilt, s], i) => (
        <mesh
          key={i}
          geometry={crystalGeo()}
          material={gemMat(color)}
          position={[x, y - 0.15, z]}
          rotation={[z * 1.4, i, -tilt]}
          scale={s * 0.7}
        />
      ))}
    </group>
  )
}

function Ingot({ color, glow = 0 }) {
  return (
    <group>
      <mesh geometry={ingotGeo()} material={metalMat(color, glow)} position={[0.02, 0.13, 0]} castShadow />
      <mesh geometry={ingotGeo()} material={metalMat(color, glow)} position={[-0.05, 0.39, 0.02]} rotation={[0, 0.25, 0]} scale={0.9} castShadow />
    </group>
  )
}

/** Stack of banknotes with a paper band. */
function CashStack() {
  return (
    <group>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} position={[0.02 * (i % 2), 0.07 + i * 0.1, 0]} rotation={[0, i * 0.06, 0]} material={matteMat(i % 2 ? '#3fae4a' : '#4cc458')} castShadow>
          <boxGeometry args={[0.9, 0.09, 0.46]} />
        </mesh>
      ))}
      <mesh position={[0, 0.22, 0]} material={matteMat('#fff4d6')}>
        <boxGeometry args={[0.16, 0.44, 0.48]} />
      </mesh>
      <mesh position={[0, 0.42, 0]} material={matteMat('#2d7a35')}>
        <boxGeometry args={[0.3, 0.005, 0.3]} />
      </mesh>
    </group>
  )
}

function ChocolateBar({ color }) {
  return (
    <group>
      <mesh position={[0, 0.1, 0]} material={plasticMat(color)} castShadow>
        <boxGeometry args={[0.95, 0.12, 0.55]} />
      </mesh>
      {[-0.33, -0.11, 0.11, 0.33].flatMap((x) =>
        [-0.13, 0.13].map((z) => (
          <mesh key={`${x}${z}`} position={[x, 0.19, z]} material={plasticMat(color)}>
            <boxGeometry args={[0.19, 0.07, 0.22]} />
          </mesh>
        )),
      )}
    </group>
  )
}

/** Classic glossy rubber duck. */
function Duck({ color }) {
  const yellow = plasticMat(color)
  return (
    <group rotation={[0, -0.4, 0]}>
      <mesh position={[0, 0.28, 0]} scale={[0.42, 0.3, 0.5]} material={yellow} castShadow>
        <sphereGeometry args={[1, 24, 16]} />
      </mesh>
      {/* tail */}
      <mesh position={[0, 0.42, -0.42]} rotation={[-0.7, 0, 0]} scale={[0.14, 0.2, 0.1]} material={yellow}>
        <sphereGeometry args={[1, 12, 8]} />
      </mesh>
      <mesh position={[0, 0.7, 0.24]} scale={0.24} material={yellow} castShadow>
        <sphereGeometry args={[1, 24, 16]} />
      </mesh>
      <mesh position={[0, 0.66, 0.5]} scale={[0.13, 0.05, 0.12]} material={plasticMat('#ff7a1a')}>
        <sphereGeometry args={[1, 16, 8]} />
      </mesh>
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh position={[s * 0.11, 0.76, 0.43]} scale={0.045} material={plasticMat('#111111')}>
            <sphereGeometry args={[1, 10, 8]} />
          </mesh>
          <mesh position={[s * 0.36, 0.33, 0.02]} rotation={[0.3, 0, s * 0.4]} scale={[0.08, 0.18, 0.28]} material={yellow}>
            <sphereGeometry args={[1, 12, 8]} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

/** Glass orb with a glowing faceted core, on a little gold stand. */
function Orb({ color, matte }) {
  if (matte) {
    return (
      <mesh position={[0, 0.34, 0]} scale={0.34} material={matteMat(color)} castShadow>
        <sphereGeometry args={[1, 24, 16]} />
      </mesh>
    )
  }
  return (
    <group>
      <mesh position={[0, 0.06, 0]} material={metalMat('#e0b040')} castShadow>
        <cylinderGeometry args={[0.24, 0.3, 0.12, 16]} />
      </mesh>
      <mesh position={[0, 0.48, 0]} scale={0.18} material={glowMat(color, 2.2)}>
        <icosahedronGeometry args={[1, 0]} />
      </mesh>
      <mesh position={[0, 0.48, 0]} scale={0.36} material={glassMat(color)}>
        <sphereGeometry args={[1, 32, 20]} />
      </mesh>
    </group>
  )
}

function Crown({ color }) {
  const spikes = 7
  return (
    <group position={[0, 0.05, 0]}>
      <mesh position={[0, 0.14, 0]} material={metalMat(color)} castShadow>
        <cylinderGeometry args={[0.36, 0.34, 0.28, 24, 1, true]} />
      </mesh>
      {Array.from({ length: spikes }, (_, i) => {
        const a = (i / spikes) * Math.PI * 2
        return (
          <group key={i}>
            <mesh position={[Math.cos(a) * 0.35, 0.4, Math.sin(a) * 0.35]} material={metalMat(color)}>
              <coneGeometry args={[0.07, 0.26, 4]} />
            </mesh>
            <mesh position={[Math.cos(a) * 0.35, 0.56, Math.sin(a) * 0.35]} scale={0.045} material={gemMat(i % 2 ? '#ff2d55' : '#2d7bff')}>
              <icosahedronGeometry args={[1, 0]} />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}

function Barrel({ color }) {
  return (
    <group>
      <mesh position={[0, 0.4, 0]} material={metalMat(color, 0.1)} castShadow>
        <cylinderGeometry args={[0.3, 0.3, 0.8, 20]} />
      </mesh>
      {[0.15, 0.65].map((y) => (
        <mesh key={y} position={[0, y, 0]} material={metalMat('#333333')}>
          <cylinderGeometry args={[0.315, 0.315, 0.05, 20]} />
        </mesh>
      ))}
      <mesh position={[0, 0.81, 0]} material={glowMat('#8dff2e', 2)}>
        <cylinderGeometry args={[0.24, 0.24, 0.03, 20]} />
      </mesh>
    </group>
  )
}

function CoinPile() {
  const coins = []
  for (let i = 0; i < 11; i++) {
    const layer = i < 6 ? 0 : i < 9 ? 1 : 2
    const a = i * 2.3
    const r = layer === 0 ? 0.28 : layer === 1 ? 0.15 : 0.02
    coins.push([Math.cos(a) * r, 0.05 + layer * 0.09, Math.sin(a) * r, a])
  }
  return coins.map(([x, y, z, a], i) => (
    <mesh key={i} position={[x, y, z]} rotation={[0.2 * Math.sin(a), a, 0.2 * Math.cos(a)]} material={metalMat('#ffc21f')} castShadow>
      <cylinderGeometry args={[0.16, 0.16, 0.05, 18]} />
    </mesh>
  ))
}

function Cake({ color }) {
  return (
    <group>
      <mesh position={[0, 0.16, 0]} material={plasticMat('#ffb3dc')} castShadow>
        <cylinderGeometry args={[0.42, 0.42, 0.32, 24]} />
      </mesh>
      <mesh position={[0, 0.44, 0]} material={plasticMat(color)} castShadow>
        <cylinderGeometry args={[0.3, 0.3, 0.26, 24]} />
      </mesh>
      <mesh position={[0, 0.65, 0]} material={plasticMat('#ff3d6e')}>
        <sphereGeometry args={[0.08, 12, 10]} />
      </mesh>
    </group>
  )
}

/** Treasure chest with gold trim, tinted by item colour. */
function Chest({ color }) {
  return (
    <group>
      <mesh position={[0, 0.2, 0]} material={matteMat(color)} castShadow>
        <boxGeometry args={[0.8, 0.4, 0.55]} />
      </mesh>
      <mesh position={[0, 0.44, 0]} rotation={[0, 0, Math.PI / 2]} material={matteMat(color)} castShadow>
        <cylinderGeometry args={[0.2, 0.2, 0.8, 16, 1, false, 0, Math.PI]} />
      </mesh>
      {[-0.3, 0.3].map((x) => (
        <mesh key={x} position={[x, 0.32, 0]} material={metalMat('#ffc21f')}>
          <boxGeometry args={[0.07, 0.68, 0.58]} />
        </mesh>
      ))}
      <mesh position={[0, 0.38, 0.29]} material={metalMat('#ffc21f')}>
        <boxGeometry args={[0.12, 0.14, 0.04]} />
      </mesh>
    </group>
  )
}

function Skull({ color }) {
  const bone = matteMat(color)
  return (
    <group rotation={[0, 0.3, 0]}>
      <mesh position={[0, 0.42, 0]} scale={[0.34, 0.32, 0.36]} material={bone} castShadow>
        <sphereGeometry args={[1, 20, 16]} />
      </mesh>
      <mesh position={[0, 0.18, 0.1]} material={bone} castShadow>
        <boxGeometry args={[0.36, 0.2, 0.3]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.12, 0.4, 0.29]} scale={[0.085, 0.1, 0.05]} material={matteMat('#15121a')}>
          <sphereGeometry args={[1, 12, 10]} />
        </mesh>
      ))}
      <mesh position={[0, 0.29, 0.33]} rotation={[0, 0, Math.PI]} material={matteMat('#15121a')}>
        <coneGeometry args={[0.04, 0.08, 3]} />
      </mesh>
      {[-0.1, -0.035, 0.035, 0.1].map((x) => (
        <mesh key={x} position={[x, 0.14, 0.26]} material={matteMat('#f4efe4')}>
          <boxGeometry args={[0.05, 0.07, 0.02]} />
        </mesh>
      ))}
    </group>
  )
}

/** A toothed metal cog lying on its side, with a smaller one on top. */
function Gear({ color }) {
  const cog = (r, y, teeth, scale = 1) => (
    <group position={[0, y, 0]} scale={scale}>
      <mesh material={metalMat(color)} castShadow>
        <cylinderGeometry args={[r, r, 0.14, 24]} />
      </mesh>
      <mesh material={metalMat('#3a2a1a')}>
        <cylinderGeometry args={[r * 0.3, r * 0.3, 0.16, 12]} />
      </mesh>
      {Array.from({ length: teeth }, (_, i) => {
        const a = (i / teeth) * Math.PI * 2
        return (
          <mesh key={i} position={[Math.cos(a) * r, 0, Math.sin(a) * r]} rotation={[0, -a, 0]} material={metalMat(color)}>
            <boxGeometry args={[0.14, 0.14, 0.1]} />
          </mesh>
        )
      })}
    </group>
  )
  return (
    <group rotation={[0.15, 0, 0.1]}>
      {cog(0.4, 0.08, 12)}
      {cog(0.22, 0.24, 8)}
    </group>
  )
}

function Model({ def }) {
  const { id, color, shape, rarity } = def
  switch (shape) {
    case 'gem':
      return HIGH_RARITY.has(rarity) ? <Diamond color={color} /> : <CrystalCluster color={color} />
    case 'bar':
      if (id === 'cash') return <CashStack />
      if (id === 'choco') return <ChocolateBar color={color} />
      return <Ingot color={color} glow={id === 'uranium' ? 0.8 : 0} />
    case 'duck':
      return <Duck color={color} />
    case 'orb':
      return <Orb color={color} matte={id === 'snowball' || id === 'sludge' || id === 'cloud'} />
    case 'crate':
      if (id.includes('crown') || id === 'halo') return <Crown color={color} />
      if (id.includes('barrel')) return <Barrel color={color} />
      if (id.includes('coin')) return <CoinPile />
      if (id.includes('cake')) return <Cake color={color} />
      return <Chest color={color} />
    case 'skull':
      return <Skull color={color} />
    case 'gear':
      return <Gear color={color} />
    default:
      return <Ore id={id} color={color} />
  }
}

/** The model plus rarity dressing: sparkles for Epic and above. */
export function ItemModel({ def, sparkles = true }) {
  // Low-end machines skip the decorative particles.
  const effects = useQuality((s) => TIERS[s.tier].effects)
  return (
    <group>
      <Model def={def} />
      {sparkles && effects && SPARKLE_RARITY.has(def.rarity) && (
        <Sparkles
          count={14}
          scale={[1.6, 1.4, 1.6]}
          position={[0, 0.7, 0]}
          size={4}
          speed={0.5}
          color={def.color}
        />
      )}
    </group>
  )
}

export default ItemModel

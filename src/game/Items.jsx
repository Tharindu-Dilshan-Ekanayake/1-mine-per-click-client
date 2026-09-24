import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { memo, useRef } from 'react'

import { useGame } from '../net/gameStore'
import { getRoom } from '../net/network'
import { ITEMS_BY_ID, RARITIES, fmt, roomFloorY } from '../shared/gameConfig'
import { localPlayer } from './localPlayer'
import { AdditiveBlending, glowTex, shadowTex } from './itemMaterials'
import { ItemModel } from './ItemModels'

const LABEL_RANGE = 26
const SPECIAL = new Set(['Legendary', 'Mythic', 'Secret', 'Divine'])
/** Rarities that get a coloured glow pooled on the floor under them. */
const GLOWING = new Set(['Rare', 'Epic', 'Legendary', 'Mythic', 'Secret', 'Divine'])

export function RarityText({ rarity }) {
  const color = RARITIES[rarity]?.color
  if (color === 'rainbow') return <span className="rainbow-text">{rarity}</span>
  return (
    <span className={rarity === 'Secret' ? 'secret-text' : undefined} style={{ color }}>
      {rarity}
    </span>
  )
}

const WorldItemView = memo(function WorldItemView({ id }) {
  const it = getRoom()?.state?.items?.get(id)
  const groupRef = useRef()
  const labelRef = useRef()
  const def = it && ITEMS_BY_ID[it.kind]

  useFrame((st) => {
    if (!it || !groupRef.current) return
    const special = SPECIAL.has(def.rarity)
    const t = st.clock.elapsedTime
    // Everything turns slowly and bobs a touch; specials float higher.
    groupRef.current.rotation.y = t * (special ? 1.2 : 0.5) + it.x
    groupRef.current.position.y = (special ? 0.45 : 0.08) + Math.sin(t * 2 + it.z) * (special ? 0.18 : 0.06)

    // Only label what's close and on the same level, or walls leak labels.
    const p = localPlayer.pos
    // ...and hide ones right in front of the lens, where they'd balloon.
    const cam = st.camera.position
    const camDist = Math.hypot(cam.x - it.x, cam.y - roomFloorY(it.stage) - 1.8, cam.z - it.z)
    const near =
      camDist > 4 &&
      Math.abs(p.y - roomFloorY(it.stage)) < 6 &&
      Math.hypot(p.x - it.x, p.z - it.z) < LABEL_RANGE
    if (labelRef.current) labelRef.current.style.display = near ? 'block' : 'none'
  })

  if (!it || !def) return null
  const special = SPECIAL.has(def.rarity)

  return (
    <group position={[it.x, roomFloorY(it.stage), it.z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <planeGeometry args={[1.5, 1.5]} />
        <meshBasicMaterial map={shadowTex()} transparent depthWrite={false} polygonOffset polygonOffsetFactor={-4} />
      </mesh>
      {GLOWING.has(def.rarity) && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
          <planeGeometry args={[special ? 4 : 2.6, special ? 4 : 2.6]} />
          <meshBasicMaterial
            map={glowTex()}
            color={def.color}
            transparent
            opacity={0.55}
            blending={AdditiveBlending}
            depthWrite={false}
            polygonOffset
            polygonOffsetFactor={-6}
          />
        </mesh>
      )}
      <group ref={groupRef}>
        <group scale={special ? 1.6 : 1}>
          <ItemModel def={def} />
        </group>
      </group>
      {/* A light beam instead of a real light: adding lights at runtime forces every
          material to recompile, which hitches the frame. */}
      {special && (
        <mesh position={[0, 4.5, 0]}>
          <boxGeometry args={[0.5, 9, 0.5]} />
          <meshBasicMaterial color={def.color} transparent opacity={0.35} depthWrite={false} />
        </mesh>
      )}
      <Html position={[0, special ? 2.6 : 1.8, 0]} center distanceFactor={9} zIndexRange={[4, 0]}>
        <div ref={labelRef} className="item-label">
          <div className="item-name">{def.name}</div>
          <div className="item-rarity">
            <RarityText rarity={def.rarity} />
          </div>
          <div className="item-value">${fmt(it.value)}</div>
        </div>
      </Html>
    </group>
  )
})

/** Renders loot for the stages around the player (deeper/shallower ones are hidden). */
export function Items() {
  const itemIds = useGame((s) => s.itemIds)
  const stage = useGame((s) => s.location.stage)
  const items = getRoom()?.state?.items

  return itemIds.map((id) => {
    const it = items?.get(id)
    if (!it || Math.abs(it.stage - stage) > 1 || (stage === 0 && it.stage > 1)) return null
    return <WorldItemView key={id} id={id} />
  })
}

export default Items

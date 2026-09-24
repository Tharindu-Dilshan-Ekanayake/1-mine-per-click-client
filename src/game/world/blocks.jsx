import { RigidBody } from '@react-three/rapier'

import { plainMaterial, studBox, studMaterial } from './blockKit'

/**
 * A single visual block. `pos` is the block centre.
 * Put it inside <Solid> to make it collide. `plain` drops the stud tiles, for
 * characters and the things they carry.
 */
export function Block({
  pos,
  size,
  color = '#cccccc',
  rot,
  cobble,
  emissive,
  opacity,
  shadow = true,
  plain = false,
  ...props
}) {
  return (
    <mesh
      position={pos}
      rotation={rot}
      geometry={studBox(size[0], size[1], size[2])}
      material={plain ? plainMaterial(color, emissive || 0) : studMaterial(color, { cobble, emissive, opacity })}
      castShadow={shadow}
      receiveShadow
      {...props}
    />
  )
}

/** Static collision for every mesh inside it (one cuboid per mesh). */
export function Solid({ children, name }) {
  return (
    <RigidBody type="fixed" colliders="cuboid" friction={1} name={name}>
      {children}
    </RigidBody>
  )
}

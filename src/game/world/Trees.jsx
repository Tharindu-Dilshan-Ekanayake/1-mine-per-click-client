import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { useLayoutEffect, useMemo, useRef } from 'react'
import { Color, Object3D } from 'three'

import { WORLD_HALF } from '../../shared/gameConfig'
import { studBox, studMaterial } from './blockKit'

/** Keep trees out of places that are already busy. */
const CLEAR = [
  { x0: -48, x1: -30, z0: -36, z1: 37 }, // training pads + their rock piles
  { x0: -11, x1: 11, z0: -48, z1: -36 }, // behind the timer board
  { x0: 28, x1: 48, z0: -20, z1: 12 }, // behind the Champions stage
]
const ROCK_PILES = [
  [-41, -40],
  [40, -38],
  [-41, 39],
  [38, 37],
]

const LEAF_GREENS = ['#3fae3a', '#4cc441', '#2f9a33', '#58c94a']
const TRUNK = '#8a5a2b'

// Tree parts: [width, height, depth, y]
const TRUNK_PART = [1.1, 5, 1.1, 2.5]
const LEAF_PARTS = [
  [5, 2.4, 5, 5.3],
  [3.8, 2, 3.8, 7.3],
  [2.4, 1.6, 2.4, 8.9],
]
const BUSH = [1.8, 1.4, 1.8, 0.7]

function useTreeSpots() {
  return useMemo(() => {
    const inset = WORLD_HALF - 4.8
    const trees = []
    const bushes = []
    const blocked = (x, z) =>
      CLEAR.some((r) => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1) ||
      ROCK_PILES.some(([rx, rz]) => Math.hypot(x - rx, z - rz) < 7)

    const step = 10
    for (let t = -inset; t <= inset + 0.01; t += step) {
      for (const [x, z] of [
        [t, -inset],
        [t, inset],
        [-inset, t],
        [inset, t],
      ]) {
        if (!blocked(x, z)) trees.push({ x, z, i: trees.length })
      }
      // A bush halfway between neighbouring trees.
      const b = t + step / 2
      if (b < inset) {
        for (const [x, z] of [
          [b, -inset - 0.8],
          [b, inset + 0.8],
          [-inset - 0.8, b],
          [inset + 0.8, b],
        ]) {
          if (!blocked(x, z)) bushes.push({ x, z })
        }
      }
    }
    // Corners appear twice (once per wall); keep one.
    const seen = new Set()
    return {
      trees: trees.filter(({ x, z }) => {
        const k = `${x},${z}`
        if (seen.has(k)) return false
        seen.add(k)
        return true
      }),
      bushes,
    }
  }, [])
}

/** Fills an instanced mesh from [x, y, z, rotY, scale, color] rows. */
function useInstances(ref, rows) {
  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const o = new Object3D()
    const c = new Color()
    rows.forEach(([x, y, z, rot, scale, color], i) => {
      o.position.set(x, y, z)
      o.rotation.set(0, rot, 0)
      o.scale.setScalar(scale)
      o.updateMatrix()
      mesh.setMatrixAt(i, o.matrix)
      mesh.setColorAt(i, c.set(color))
    })
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [ref, rows])
}

function Layer({ rows, size }) {
  const ref = useRef()
  useInstances(ref, rows)
  return (
    <instancedMesh
      ref={ref}
      args={[studBox(size[0], size[1], size[2]), studMaterial('#ffffff'), rows.length]}
      castShadow
      receiveShadow
    />
  )
}

/** Blocky Roblox-style trees and bushes lining the inside of the lobby walls. */
export function Trees() {
  const { trees, bushes } = useTreeSpots()

  const layers = useMemo(() => {
    const trunk = []
    const leaves = LEAF_PARTS.map(() => [])
    trees.forEach(({ x, z, i }) => {
      const s = 0.85 + ((i * 37) % 30) / 100 // 0.85 – 1.14, varied but stable
      const rot = (i % 2) * (Math.PI / 4)
      const green = LEAF_GREENS[i % LEAF_GREENS.length]
      trunk.push([x, TRUNK_PART[3] * s, z, rot, s, TRUNK])
      LEAF_PARTS.forEach((p, li) => {
        const shade = li === 0 ? green : LEAF_GREENS[(i + li) % LEAF_GREENS.length]
        leaves[li].push([x, p[3] * s, z, rot + li * 0.2, s, shade])
      })
    })
    const bush = bushes.map(({ x, z }, i) => [x, BUSH[3], z, i * 0.7, 0.9 + (i % 3) * 0.15, LEAF_GREENS[(i + 1) % 4]])
    return { trunk, leaves, bush }
  }, [trees, bushes])

  return (
    <group>
      <Layer rows={layers.trunk} size={TRUNK_PART} />
      {LEAF_PARTS.map((p, i) => (
        <Layer key={i} rows={layers.leaves[i]} size={p} />
      ))}
      <Layer rows={layers.bush} size={BUSH} />

      {/* Only trunks collide; you can walk under the leaves. */}
      <RigidBody type="fixed" colliders={false} name="trees">
        {trees.map(({ x, z }, i) => (
          <CuboidCollider key={i} args={[0.55, 2.5, 0.55]} position={[x, 2.5, z]} />
        ))}
      </RigidBody>
    </group>
  )
}

export default Trees

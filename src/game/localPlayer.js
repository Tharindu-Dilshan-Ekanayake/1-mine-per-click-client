import { Vector3 } from 'three'

/**
 * Where the local player is, updated every frame by <Player>. A plain mutable
 * object so other `useFrame` loops (label culling, the sun) can read it for free.
 */
export const localPlayer = {
  pos: new Vector3(0, 1, 12),
  stage: 0,
}

/**
 * Where the first-time guide is pointing right now. The HUD's <Guide> decides
 * the step and writes the target here; <GuidePath> in the scene draws the
 * arrows every frame from it (no React re-render needed).
 */
export const guideTarget = {
  on: false,
  x: 0,
  y: 0,
  z: 0,
  /** Draw a trail of arrows along the ground from the player to the target. */
  path: true,
}

export function pointGuideAt(target) {
  if (!target) {
    guideTarget.on = false
    return
  }
  guideTarget.on = true
  guideTarget.x = target.x
  guideTarget.y = target.y
  guideTarget.z = target.z
  guideTarget.path = target.path !== false
}

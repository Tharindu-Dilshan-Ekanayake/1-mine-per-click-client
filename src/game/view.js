import { getGame, useGame } from '../net/gameStore'

/**
 * Camera orbit angles, shared by the camera (which draws from them), the mouse
 * (which aims them) and the player (whose A/D keys turn them).
 * yaw 0 puts the camera behind the player on +Z, looking toward -Z.
 */
export const view = { yaw: 0, pitch: 0.32, distance: 8 }

/**
 * Mouse capture (pointer lock). While locked the cursor is hidden and moving the
 * mouse turns the camera, no button needed. Esc releases it (the browser does that
 * itself); clicking the game again, or closing a menu, captures it again.
 */
let canvas = null

export function setLockTarget(el) {
  canvas = el
}

export const isPointerLocked = () => Boolean(canvas) && document.pointerLockElement === canvas

export function lockPointer() {
  if (!canvas || isPointerLocked() || getGame().modal || !getGame().started) return
  try {
    // Chrome returns a promise that rejects if we re-lock too soon after Esc.
    const result = canvas.requestPointerLock?.()
    result?.catch?.(() => {})
  } catch {
    /* not allowed right now: the next click will try again */
  }
}

export function unlockPointer() {
  if (document.pointerLockElement) document.exitPointerLock?.()
}

if (typeof document !== 'undefined') {
  document.addEventListener('pointerlockchange', () => useGame.setState({ locked: isPointerLocked() }))
  // Menus need the cursor; closing one hands the mouse back to the camera.
  useGame.subscribe((s, prev) => {
    if (s.modal === prev.modal) return
    if (s.modal) unlockPointer()
    else lockPointer()
  })
}

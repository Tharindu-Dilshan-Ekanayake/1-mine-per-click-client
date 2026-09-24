/**
 * Touch input, read every frame by Player.jsx exactly like keyboard state (see
 * useKeyboard.js) - a plain mutable object, not React state, so nothing here
 * re-renders 60x a second.
 *
 * `moveX`/`moveY` come from the on-screen joystick (TouchControls.jsx), each
 * -1..1. moveY follows the same convention as `_input.z` in Player.jsx: +1 is
 * "push backward". `jump` and `attack` are booleans, held down like keys.
 */
export const touchInput = {
  active: false,
  moveX: 0,
  moveY: 0,
  jump: false,
  attack: false,
}

/**
 * True on phones/tablets: the browser's primary pointing device is a finger,
 * not a mouse or trackpad. A laptop's touchscreen doesn't count - its primary
 * pointer is still "fine" (the mouse/trackpad), so it keeps keyboard/mouse
 * controls even though `ontouchstart` exists.
 */
export const isTouchDevice =
  typeof window !== 'undefined'
    ? (window.matchMedia?.('(pointer: coarse)').matches ?? navigator.maxTouchPoints > 0)
    : false

import { useEffect, useRef } from 'react'

import { touchInput } from './touchInput'

/** Joystick knob travel, in CSS pixels, before it's clamped to the base's edge. */
const JOYSTICK_RADIUS = 44
/** Below this fraction of the radius, the joystick counts as centred (dead zone). */
const DEAD_ZONE = 0.12

/**
 * Left-thumb joystick: drag from anywhere inside the base to set movement
 * direction. Mirrors useKeyboard.js's philosophy - writes straight into the
 * shared `touchInput` object every event, no React state, so it costs nothing
 * per frame.
 */
function Joystick() {
  const baseRef = useRef(null)
  const knobRef = useRef(null)
  const originRef = useRef({ x: 0, y: 0 })
  const pointerId = useRef(null)

  useEffect(() => {
    const base = baseRef.current
    const knob = knobRef.current
    if (!base || !knob) return

    const setKnob = (dx, dy) => {
      knob.style.transform = `translate(${dx}px, ${dy}px)`
    }

    const onDown = (e) => {
      if (pointerId.current !== null) return
      pointerId.current = e.pointerId
      base.setPointerCapture?.(e.pointerId)
      const rect = base.getBoundingClientRect()
      originRef.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
      touchInput.active = true
      onMove(e)
    }

    const onMove = (e) => {
      if (e.pointerId !== pointerId.current) return
      const { x: ox, y: oy } = originRef.current
      let dx = e.clientX - ox
      let dy = e.clientY - oy
      const dist = Math.hypot(dx, dy)
      if (dist > JOYSTICK_RADIUS) {
        dx = (dx / dist) * JOYSTICK_RADIUS
        dy = (dy / dist) * JOYSTICK_RADIUS
      }
      setKnob(dx, dy)
      const nx = dx / JOYSTICK_RADIUS
      const ny = dy / JOYSTICK_RADIUS
      const mag = Math.hypot(nx, ny)
      if (mag < DEAD_ZONE) {
        touchInput.moveX = 0
        touchInput.moveY = 0
      } else {
        touchInput.moveX = nx
        // Screen down (+y) is "pull toward you" = backward, matching _input.z.
        touchInput.moveY = ny
      }
    }

    const onUp = (e) => {
      if (e.pointerId !== pointerId.current) return
      pointerId.current = null
      touchInput.active = false
      touchInput.moveX = 0
      touchInput.moveY = 0
      setKnob(0, 0)
    }

    base.addEventListener('pointerdown', onDown)
    base.addEventListener('pointermove', onMove)
    base.addEventListener('pointerup', onUp)
    base.addEventListener('pointercancel', onUp)
    return () => {
      base.removeEventListener('pointerdown', onDown)
      base.removeEventListener('pointermove', onMove)
      base.removeEventListener('pointerup', onUp)
      base.removeEventListener('pointercancel', onUp)
    }
  }, [])

  return (
    <div ref={baseRef} className="touch-joystick">
      <div ref={knobRef} className="touch-joystick-knob" />
    </div>
  )
}

/** A round button that sets `touchInput[field]` while held (jump, attack). */
function HoldButton({ field, className, children }) {
  const down = (e) => {
    e.preventDefault()
    touchInput[field] = true
  }
  const up = () => {
    touchInput[field] = false
  }
  return (
    <button
      type="button"
      className={`touch-btn ${className}`}
      onPointerDown={down}
      onPointerUp={up}
      onPointerLeave={up}
      onPointerCancel={up}
      onContextMenu={(e) => e.preventDefault()}
    >
      {children}
    </button>
  )
}

/**
 * On-screen controls for phones/tablets: a movement joystick (bottom-left),
 * jump and attack buttons (bottom-right). Interact ("E" in HUD.jsx's <Prompt>)
 * is already a real DOM button, so it's tappable as-is - no separate control
 * needed for it here.
 *
 * Rendered only for touch devices (see touchInput.isTouchDevice, checked by
 * the caller); the camera look-drag itself lives in FollowCamera, since it's
 * just "drag anywhere that isn't one of these buttons", handled by the
 * canvas's own pointer listener.
 */
export function TouchControls() {
  return (
    <div className="touch-controls">
      <Joystick />
      <div className="touch-actions">
        <HoldButton field="jump" className="touch-jump">
          ⤒
        </HoldButton>
        <HoldButton field="attack" className="touch-attack">
          ⛏️
        </HoldButton>
      </div>
    </div>
  )
}

export default TouchControls

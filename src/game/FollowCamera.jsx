import { useFrame, useThree } from '@react-three/fiber'
import { useRapier } from '@react-three/rapier'
import { useEffect, useRef } from 'react'
import { Vector3 } from 'three'

import { isPointerLocked, lockPointer, setLockTarget, view } from './view'

/** How high above the player's origin the camera aims. */
const LOOK_HEIGHT = 1.4

const MIN_DISTANCE = 3
const MAX_DISTANCE = 20

// Pitch limits, in radians. Stops the camera flipping over the top or sinking
// under the track.
const MIN_PITCH = -0.15
const MAX_PITCH = 1.25

const DRAG_SENSITIVITY = 0.005
const LOCKED_SENSITIVITY = 0.0028
const ZOOM_SENSITIVITY = 0.01

// Higher = snappier. Framerate-independent via the pow() smoothing below.
const POSITION_SMOOTHING = 9
/** Gap kept between the camera and any wall it gets pushed against. */
const WALL_PADDING = 0.35
const LOOK_SMOOTHING = 8

const _desired = new Vector3()
const _target = new Vector3()
const _head = new Vector3()
const _dir = new Vector3()

const clampPitch = (p) => Math.min(MAX_PITCH, Math.max(MIN_PITCH, p))

/**
 * Third-person orbit camera.
 *
 * Trails the player's rigid body, easing both position and look-at target. With
 * the mouse captured (pointer lock) plain mouse movement orbits; without it,
 * right-click drag does. The wheel zooms, and A/D turn it (see Player). A ray
 * from the player's head pulls the camera in front of walls, which matters in
 * the narrow mine shafts, so this must be mounted inside <Physics>.
 *
 * @param {{ bodyRef: React.MutableRefObject<any> }} props
 */
export function FollowCamera({ bodyRef }) {
  const camera = useThree((s) => s.camera)
  const gl = useThree((s) => s.gl)
  const { world, rapier } = useRapier()

  const lookAt = useRef(new Vector3())
  const initialised = useRef(false)

  useEffect(() => {
    const el = gl.domElement
    if (!el) return
    setLockTarget(el)

    let dragging = false
    let lastX = 0
    let lastY = 0

    const onPointerDown = (e) => {
      // Clicking the game captures the mouse again (e.g. after Esc).
      if (e.button === 0 && !isPointerLocked()) lockPointer()
      if (e.button !== 2) return // right button only
      dragging = true
      lastX = e.clientX
      lastY = e.clientY
      el.setPointerCapture?.(e.pointerId)
    }

    const onPointerMove = (e) => {
      if (isPointerLocked()) {
        view.yaw -= e.movementX * LOCKED_SENSITIVITY
        view.pitch = clampPitch(view.pitch + e.movementY * LOCKED_SENSITIVITY)
        return
      }
      if (!dragging) return
      const dx = e.clientX - lastX
      const dy = e.clientY - lastY
      lastX = e.clientX
      lastY = e.clientY
      view.yaw -= dx * DRAG_SENSITIVITY
      view.pitch = clampPitch(view.pitch + dy * DRAG_SENSITIVITY)
    }

    const endDrag = (e) => {
      if (!dragging) return
      dragging = false
      el.releasePointerCapture?.(e.pointerId)
    }

    const onWheel = (e) => {
      // Without this the page scrolls behind the canvas.
      e.preventDefault()
      view.distance = Math.min(MAX_DISTANCE, Math.max(MIN_DISTANCE, view.distance + e.deltaY * ZOOM_SENSITIVITY))
    }

    // Right-dragging otherwise opens the browser context menu mid-orbit.
    const onContextMenu = (e) => e.preventDefault()

    el.addEventListener('pointerdown', onPointerDown)
    // Locked mouse movement arrives on the document, not the canvas.
    document.addEventListener('pointermove', onPointerMove)
    el.addEventListener('pointerup', endDrag)
    el.addEventListener('pointercancel', endDrag)
    el.addEventListener('contextmenu', onContextMenu)
    // passive:false is required for preventDefault() on wheel to take effect.
    el.addEventListener('wheel', onWheel, { passive: false })

    return () => {
      el.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('pointermove', onPointerMove)
      el.removeEventListener('pointerup', endDrag)
      el.removeEventListener('pointercancel', endDrag)
      el.removeEventListener('contextmenu', onContextMenu)
      el.removeEventListener('wheel', onWheel)
    }
  }, [gl])

  useFrame((_state, delta) => {
    const body = bodyRef.current
    if (!body) return

    const pos = body.translation()
    _target.set(pos.x, pos.y, pos.z)

    // Spherical -> cartesian. yaw 0 puts the camera behind the player on +Z.
    const { yaw, pitch, distance } = view
    const horizontal = Math.cos(pitch) * distance
    _desired.set(
      _target.x + Math.sin(yaw) * horizontal,
      _target.y + Math.sin(pitch) * distance + LOOK_HEIGHT,
      _target.z + Math.cos(yaw) * horizontal,
    )

    // Keep walls from getting between the camera and the player.
    _head.set(_target.x, _target.y + LOOK_HEIGHT, _target.z)
    _dir.subVectors(_desired, _head)
    const reach = _dir.length()
    let blocked = false
    if (reach > 0.001) {
      _dir.divideScalar(reach)
      const hit = world.castRay(
        new rapier.Ray(_head, _dir),
        reach,
        true,
        undefined,
        undefined,
        undefined,
        body, // never hit ourselves
      )
      if (hit) {
        const d = Math.max(0.5, hit.timeOfImpact - WALL_PADDING)
        _desired.copy(_head).addScaledVector(_dir, d)
        blocked = camera.position.distanceTo(_head) > d
      }
    }

    if (!initialised.current || blocked) {
      // Snap rather than ease: on the first frame to avoid a long swoop in, and
      // when a wall cuts in so the camera never ends up behind it.
      camera.position.copy(_desired)
      if (!initialised.current) lookAt.current.copy(_target).setY(_target.y + LOOK_HEIGHT)
      initialised.current = true
    }

    // 1 - pow(x, delta) keeps the easing rate consistent across framerates.
    camera.position.lerp(_desired, 1 - Math.pow(0.001, delta * (POSITION_SMOOTHING / 10)))

    _target.y += LOOK_HEIGHT
    lookAt.current.lerp(_target, 1 - Math.pow(0.001, delta * (LOOK_SMOOTHING / 10)))
    camera.lookAt(lookAt.current)
  })

  return null
}

export default FollowCamera

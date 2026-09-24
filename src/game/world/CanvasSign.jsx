import { useEffect, useMemo, useState } from 'react'
import { CanvasTexture, DoubleSide, SRGBColorSpace } from 'three'

/** Re-renders once web fonts finish loading so canvas text isn't stuck on the fallback. */
let fontsReady = false
const fontListeners = new Set()
if (typeof document !== 'undefined' && document.fonts) {
  document.fonts.ready.then(() => {
    fontsReady = true
    fontListeners.forEach((fn) => fn())
  })
}

function useFontsReady() {
  const [ready, setReady] = useState(fontsReady)
  useEffect(() => {
    if (ready) return
    const fn = () => setReady(true)
    fontListeners.add(fn)
    return () => fontListeners.delete(fn)
  }, [ready])
  return ready
}

/**
 * A canvas texture, rebuilt whenever `deps` change (or web fonts finish loading).
 * `draw(ctx, width, height)` paints the whole canvas.
 */
function useCanvasTexture(width, height, draw, deps) {
  const fonts = useFontsReady()
  const depKey = JSON.stringify(deps)
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    draw(canvas.getContext('2d'), width, height)
    const tex = new CanvasTexture(canvas)
    tex.colorSpace = SRGBColorSpace
    tex.anisotropy = 8
    return tex
    // `draw` is a fresh closure every render; `deps` says when its output changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height, fonts, depKey])

  useEffect(() => () => texture.dispose(), [texture])
  return texture
}

/**
 * A flat sign in the world. `size` is [width, height] in world units; the canvas
 * resolution follows the aspect ratio.
 */
export function CanvasSign({
  size = [4, 1],
  resolution = 128,
  draw,
  deps = [],
  transparent = true,
  emissive = 0.35,
  doubleSide = false,
  ...props
}) {
  const [w, h] = size
  const texture = useCanvasTexture(
    Math.round(w * resolution),
    Math.round(h * resolution),
    draw,
    deps,
  )
  return (
    <mesh {...props}>
      <planeGeometry args={[w, h]} />
      <meshStandardMaterial
        map={texture}
        transparent={transparent}
        alphaTest={transparent ? 0.02 : 0}
        emissive="#ffffff"
        emissiveMap={texture}
        emissiveIntensity={emissive}
        roughness={0.9}
        side={doubleSide ? DoubleSide : undefined}
        // Signs sit a hair in front of the block they're mounted on; the offset
        // keeps them from flickering into it at a distance.
        polygonOffset
        polygonOffsetFactor={-4}
      />
    </mesh>
  )
}

export default CanvasSign

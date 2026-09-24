import { Environment, Lightformer, PerformanceMonitor } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { Physics } from '@react-three/rapier'
import { Suspense, useCallback, useEffect, useRef, useState } from 'react'

import { useBloxity } from '../bloxity/BloxityContext'
import { useGame } from '../net/gameStore'
import { SPAWN } from '../shared/gameConfig'
// Explicit extension: this folder once had a lowercase effects.js, and on Windows a
// dev server's cached, case-insensitive lookup could still resolve ./Effects to it.
import Effects from './Effects.jsx'
import FollowCamera from './FollowCamera'
import Items from './Items'
import { localPlayer } from './localPlayer'
import Player from './Player'
import { START_ANTIALIAS, TIERS, useQuality } from './quality'
import RemotePlayers from './RemotePlayers'
import Champions from './world/Champions'
import Mine from './world/Mine'
import GuidePath from './world/GuidePath'
import Stalls from './world/Stalls'
import Surface from './world/Surface'
import Training from './world/Training'

/**
 * Fires `onFirstFrame` after the renderer has actually drawn once.
 * `loadingEnd()` should mean "the player can see the game", not "React mounted".
 */
function FirstFrameSignal({ onFirstFrame }) {
  const fired = useRef(false)
  useFrame(() => {
    if (fired.current) return
    fired.current = true
    onFirstFrame()
  })
  return null
}

/**
 * Directional light that follows the player, so a small, sharp shadow map covers
 * wherever they are instead of one blurry map stretched over the whole world.
 */
function Sun() {
  const lightRef = useRef()
  const tier = useQuality((s) => TIERS[s.tier])
  // Shadows follow the quality tier; a new map size needs a fresh shadow map.
  useEffect(() => {
    const light = lightRef.current
    if (!light) return
    light.castShadow = tier.shadows
    light.shadow.mapSize.set(tier.shadowSize, tier.shadowSize)
    // Drop the old map; three.js rebuilds it at the new size on the next frame.
    light.shadow.map?.dispose()
    light.shadow.map = null
  }, [tier])
  useFrame(() => {
    const light = lightRef.current
    if (!light) return
    const p = localPlayer.pos
    light.position.set(p.x + 18, p.y + 40, p.z + 14)
    light.target.position.set(p.x, p.y, p.z)
    light.target.updateMatrixWorld()
  })
  return (
    <directionalLight
      ref={lightRef}
      castShadow={tier.shadows}
      intensity={2.2}
      color="#fff6e5"
      shadow-mapSize={[tier.shadowSize, tier.shadowSize]}
      shadow-camera-left={-tier.shadowArea}
      shadow-camera-right={tier.shadowArea}
      shadow-camera-top={tier.shadowArea}
      shadow-camera-bottom={-tier.shadowArea}
      shadow-camera-near={1}
      shadow-camera-far={120}
      // Tuned per tier: a smaller shadow map covers the same area with fewer
      // texels, so it needs more bias to avoid self-shadowing "shadow acne" -
      // flickering dark stripes on flat surfaces that read as z-fighting.
      shadow-bias={tier.bias}
      shadow-normalBias={tier.normalBias}
    />
  )
}

/** Longest the loading screen waits for the player's SDK avatar. */
const AVATAR_WAIT_MS = 20000

/** Stable reference: RigidBody re-applies `position` whenever the prop changes. */
const PLAYER_START = [SPAWN.x, SPAWN.y + 1, SPAWN.z]

/** The world only mounts after we've joined a lobby, so it builds from real state. */
function World({ playerBodyRef, onAvatarReady }) {
  const connected = useGame((s) => s.status === 'connected' && Boolean(s.me))
  return (
    <>
      <Surface />
      <Stalls />
      <Training />
      <Champions />
      <Mine />
      <Effects />
      <GuidePath />
      {connected && (
        <>
          <Items />
          <RemotePlayers />
        </>
      )}
      <Player
        bodyRef={playerBodyRef}
        position={PLAYER_START}
        onAvatarReady={onAvatarReady}
      />
    </>
  )
}

/**
 * Watches the frame rate and moves the quality tier: down when the game stutters,
 * back up when there's headroom. After a few flip-flops it settles for good.
 */
function AutoQuality() {
  const settled = useQuality((s) => s.settled)
  const { lower, raise, settle, setResFactor } = useQuality.getState()
  return (
    <PerformanceMonitor
      // Continuous: eases the render resolution within the current tier every
      // reading, so small dips smooth themselves out with no visible "quality
      // drop". factor is drei's own 0-1 rolling estimate of headroom.
      onChange={({ factor }) => setResFactor(factor)}
      // Discrete: only after it's sure (flipflops), step shadows/effects too.
      onDecline={settled ? undefined : lower}
      onIncline={settled ? undefined : raise}
      flipflops={4}
      onFallback={settle}
    />
  )
}

export function GameScene() {
  const { game } = useBloxity()
  const tier = useQuality((s) => TIERS[s.tier])
  const resFactor = useQuality((s) => s.resFactor)
  const dpr = Math.min(window.devicePixelRatio || 1, tier.dprMin + (tier.dprMax - tier.dprMin) * resFactor)
  const playerBodyRef = useRef(null)

  const [avatarReady, setAvatarReady] = useState(false)
  const loadingEnded = useRef(false)

  const handleAvatarReady = useCallback(() => {
    setAvatarReady(true)
    useGame.setState({ avatarReady: true })
  }, [])

  // Only end the loading screen once the avatar has finished assembling *and* a
  // frame has rendered with it in place.
  const handleFirstFrame = useCallback(() => {
    useGame.setState({ sceneReady: true })
    if (loadingEnded.current || !avatarReady) return
    loadingEnded.current = true
    game.loadingEnd()
  }, [avatarReady, game])

  // The first frame usually renders before the avatar finishes downloading, so the
  // frame callback alone isn't enough — close the loading screen here too.
  useEffect(() => {
    if (!avatarReady || loadingEnded.current) return
    loadingEnded.current = true
    game.loadingEnd()
  }, [avatarReady, game])

  useEffect(() => {
    game.loadingStep('Preparing scene…')
  }, [game])

  // The SDK avatar CDN can be very slow: don't hold the loading screen forever.
  useEffect(() => {
    const t = setTimeout(handleAvatarReady, AVATAR_WAIT_MS)
    return () => clearTimeout(t)
  }, [handleAvatarReady])

  return (
    <Canvas
      shadows
      dpr={dpr}
      gl={{ antialias: START_ANTIALIAS, powerPreference: 'high-performance' }}
      // near 0.2 (not 0.1) doubles depth precision at range, which is what
      // keeps thin decals and floors from z-fighting far from the camera.
      camera={{ position: [0, 5, 22], fov: 60, near: 0.2, far: 600 }}
      onCreated={({ gl }) => gl.setClearColor('#7fd3ff')}
    >
      <fog attach="fog" args={['#9fdcff', 90, 260]} />
      <hemisphereLight args={['#dff2ff', '#7a6a55', 1.0]} />
      <ambientLight intensity={0.2} />
      <Sun />
      {/* Reflections for gems and metal, built locally from light panels (no HDR download). */}
      <Environment resolution={128} environmentIntensity={0.45}>
        <color attach="background" args={['#8fd0ff']} />
        <Lightformer form="rect" intensity={4} position={[0, 12, 0]} rotation-x={Math.PI / 2} scale={[24, 24, 1]} />
        <Lightformer form="rect" intensity={2.5} color="#ffe9c4" position={[12, 4, 6]} rotation-y={-Math.PI / 2} scale={[12, 4, 1]} />
        <Lightformer form="rect" intensity={2} color="#c8e6ff" position={[-12, 3, -6]} rotation-y={Math.PI / 2} scale={[12, 4, 1]} />
        <Lightformer form="ring" intensity={3} position={[0, 3, 12]} scale={4} />
      </Environment>

      <Suspense fallback={null}>
        <Physics gravity={[0, -24, 0]}>
          <World playerBodyRef={playerBodyRef} onAvatarReady={handleAvatarReady} />
          {/* Inside Physics: it raycasts against the world to avoid walls. */}
          <FollowCamera bodyRef={playerBodyRef} />
        </Physics>
      </Suspense>

      <FirstFrameSignal onFirstFrame={handleFirstFrame} />
      <AutoQuality />
    </Canvas>
  )
}

export default GameScene

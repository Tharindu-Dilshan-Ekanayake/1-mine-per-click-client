import { useEffect, useRef, useState } from 'react'

import { useBloxity } from '../bloxity/BloxityContext'
import { useGame } from '../net/gameStore'

/** Loading milestones and how much of the bar each one is worth (sums to 100). */
const STEPS = [
  ['fonts', 10, 'Sharpening pickaxes…'],
  ['sdk', 20, 'Checking your account…'],
  ['scene', 25, 'Building the world…'],
  ['server', 30, 'Finding a lobby…'],
  ['avatar', 15, 'Dressing your miner…'],
]

const TIPS = [
  'Train on pads to hit harder — press E on a pad to unlock it.',
  'Deeper stages hide far more valuable loot.',
  'Each stage needs a stronger pickaxe. Save up!',
  'A full backpack sends you home — buy a bigger bag.',
  'Press P for pickaxes, B for bags, U for upgrades.',
  'A/D turns the camera. Hold right-click to look around freely.',
]

function useFontsReady() {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    let alive = true
    const done = () => alive && setReady(true)
    // Don't let a slow font CDN hold the whole game.
    const t = setTimeout(done, 3000)
    document.fonts?.ready.then(done, done)
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [])
  return ready
}

/**
 * Full-screen title + loading bar. The bar is driven by real milestones, eased
 * so it counts smoothly from 0 to 100 and creeps forward while a step is slow.
 * At 100 it fades out by itself, straight into the lobby. (Browsers only allow
 * mouse capture and audio after a click, so the first click in the game does
 * that - see FollowCamera and sound.js.)
 */
export function LoadingScreen() {
  const bloxityStatus = useBloxity().status
  const fonts = useFontsReady()
  const scene = useGame((s) => s.sceneReady)
  const server = useGame((s) => s.status === 'connected' && Boolean(s.me))
  const avatar = useGame((s) => s.avatarReady)
  const error = useGame((s) => s.error)

  const [sdkWaited, setSdkWaited] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setSdkWaited(true), 4000)
    return () => clearTimeout(t)
  }, [])
  const sdk = bloxityStatus === 'ready' || bloxityStatus === 'error' || sdkWaited

  const done = { fonts, sdk, scene, server, avatar }
  const target = STEPS.reduce((sum, [key, weight]) => sum + (done[key] ? weight : 0), 0)
  const current = STEPS.find(([key]) => !done[key])
  const status = error && !server ? error : current ? current[2] : 'Ready!'

  // Smoothly animated percentage.
  const [shown, setShown] = useState(0)
  const targetRef = useRef(target)
  const changedAt = useRef(0)
  useEffect(() => {
    targetRef.current = target
    changedAt.current = performance.now()
  }, [target])
  useEffect(() => {
    let raf = 0
    let last = performance.now()
    let value = 0
    const tick = (now) => {
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      const t = targetRef.current
      // While waiting on a step, creep part-way into it so the bar never looks stuck.
      const waited = (now - changedAt.current) / 1000
      const cap = t >= 100 ? 100 : t + (100 - t) * 0.3 * (1 - Math.exp(-waited / 5))
      value = Math.min(100, value + (cap - value) * Math.min(1, dt * 4) + (value < cap ? dt * 6 : 0))
      value = Math.min(value, cap)
      setShown(value)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  const [tip, setTip] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setTip((i) => (i + 1) % TIPS.length), 3200)
    return () => clearInterval(t)
  }, [])

  const [leaving, setLeaving] = useState(false)
  const [gone, setGone] = useState(false)
  const complete = target >= 100 && shown > 99.5

  // Loaded: hold 100% for a moment, then fade into the lobby.
  useEffect(() => {
    if (!complete) return
    const enter = setTimeout(() => {
      useGame.setState({ started: true })
      setLeaving(true)
    }, 350)
    const remove = setTimeout(() => setGone(true), 950)
    return () => {
      clearTimeout(enter)
      clearTimeout(remove)
    }
  }, [complete])

  if (gone) return null
  const pct = Math.floor(shown)

  return (
    <div className={`loading ${leaving ? 'leaving' : ''}`}>
      <div className="loading-studs" />
      <div className="loading-card">
        <div className="loading-pick">⛏️</div>
        <h1 className="loading-title game-text">
          <span className="lt-1">+1</span> <span className="lt-mine">MINE</span>
          <br />
          <span className="lt-per">PER</span> <span className="lt-click">CLICK</span>
        </h1>
        <div className="loading-sub game-text">Dig deeper · Get stronger · Get rich</div>

        <div className="loading-bar">
          <div className="loading-fill" style={{ width: `${shown}%` }} />
          <span className="loading-pct game-text">{pct}%</span>
        </div>
        <div className="loading-status">{status}</div>
        <div className="loading-tip">💡 {TIPS[tip]}</div>
      </div>
    </div>
  )
}

export default LoadingScreen

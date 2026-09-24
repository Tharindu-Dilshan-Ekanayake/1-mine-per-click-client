import { create } from 'zustand'

/**
 * Automatic graphics quality: no settings menu, tuned to look as sharp as the
 * machine allows while never becoming unplayable.
 *
 * Two mechanisms work together:
 *  - Tier (0-3): the heavy switches - shadow map size/bias, sparkles on/off.
 *    <PerformanceMonitor>'s onIncline/onDecline step this, only after several
 *    consecutive good/bad readings (flipflops), so it doesn't thrash.
 *  - Resolution factor (0-1): a continuous multiplier within the current
 *    tier's [dprMin, dprMax] range, driven every frame by the monitor's own
 *    rolling performance estimate. This is what actually keeps a low-end
 *    machine smooth without a visible "quality drop" - the render resolution
 *    just eases down a little instead of shadows/effects snapping off.
 *
 *   dprMax  - render resolution cap (x devicePixelRatio) at full headroom
 *   dprMin  - resolution floor for this tier, used when frames are tight
 *   shadows - sun shadows on/off, and their map size
 *   effects - sparkles and other purely decorative particles
 */
export const TIERS = [
  { name: 'low', dprMax: 0.85, dprMin: 0.5, shadows: false, shadowSize: 512, shadowArea: 22, bias: -0.0015, normalBias: 0.12, effects: false },
  { name: 'medium', dprMax: 1.25, dprMin: 0.75, shadows: true, shadowSize: 1024, shadowArea: 26, bias: -0.0009, normalBias: 0.06, effects: true },
  { name: 'high', dprMax: 1.75, dprMin: 1, shadows: true, shadowSize: 2048, shadowArea: 30, bias: -0.0005, normalBias: 0.035, effects: true },
  { name: 'ultra', dprMax: 2, dprMin: 1.25, shadows: true, shadowSize: 2048, shadowArea: 34, bias: -0.0004, normalBias: 0.025, effects: true },
]

/** The GPU's name, e.g. "ANGLE (NVIDIA GeForce RTX 3060 ...)", or ''. */
function gpuName() {
  try {
    const gl = document.createElement('canvas').getContext('webgl')
    const ext = gl?.getExtension('WEBGL_debug_renderer_info')
    const name = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : ''
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
    return String(name || '')
  } catch {
    return ''
  }
}

/** Best starting tier for this machine (index into TIERS). */
function guessTier() {
  if (typeof window === 'undefined') return 1
  const gpu = gpuName()
  const cores = navigator.hardwareConcurrency || 4
  const memory = navigator.deviceMemory || 8
  const mobile = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent)

  // Software rendering or very old / tiny GPUs.
  if (/SwiftShader|llvmpipe|Software|Microsoft Basic/i.test(gpu)) return 0
  if (mobile || cores <= 2 || memory <= 2) return 0
  // Dedicated GPUs and Apple Silicon.
  if (/NVIDIA|GeForce|RTX|GTX|Radeon RX|Radeon Pro|Apple M\d/i.test(gpu)) return cores >= 8 ? 3 : 2
  // Integrated graphics (Intel HD/UHD/Iris, AMD APUs) and everything else.
  if (/Intel|UHD|Iris|Radeon\(TM\) Graphics|Vega/i.test(gpu)) return cores >= 8 ? 2 : 1
  return cores >= 8 && memory >= 8 ? 2 : 1
}

const START = guessTier()

export const useQuality = create((set, get) => ({
  tier: START,
  /** The frame-rate monitor gave up flip-flopping: stay where we are. */
  settled: false,
  /** 0-1: how much of the current tier's resolution headroom to use right now. */
  resFactor: 1,
  lower: () => set({ tier: Math.max(0, get().tier - 1), resFactor: 1 }),
  raise: () => set({ tier: Math.min(TIERS.length - 1, get().tier + 1), resFactor: 1 }),
  settle: () => set({ settled: true }),
  setResFactor: (f) => set({ resFactor: f }),
}))

export const qualityTier = () => TIERS[useQuality.getState().tier]

/** The DPR to render at right now: eased within the tier's range by resFactor. */
export function currentDpr(state = useQuality.getState()) {
  const t = TIERS[state.tier]
  return t.dprMin + (t.dprMax - t.dprMin) * state.resFactor
}
/** Antialiasing can't change after the canvas exists, so it follows the first guess. */
export const START_ANTIALIAS = START >= 1

// Kept for any external caller still asking for the plain max cap.
export const initialDpr = TIERS[START].dprMax

import { create } from 'zustand'

/**
 * Automatic graphics quality: no settings menu. We guess a starting tier from
 * the hardware, then <PerformanceMonitor> in the scene steps it down when the
 * frame rate drops and back up when there is headroom.
 *
 *   dpr     - render resolution cap (x devicePixelRatio)
 *   shadows - sun shadows on/off, and their map size
 *   effects - sparkles and other purely decorative particles
 */
export const TIERS = [
  { name: 'low', dpr: 0.75, shadows: false, shadowSize: 512, effects: false },
  { name: 'medium', dpr: 1, shadows: true, shadowSize: 1024, effects: true },
  { name: 'high', dpr: 1.5, shadows: true, shadowSize: 2048, effects: true },
  { name: 'ultra', dpr: 2, shadows: true, shadowSize: 2048, effects: true },
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
  lower: () => set({ tier: Math.max(0, get().tier - 1) }),
  raise: () => set({ tier: Math.min(TIERS.length - 1, get().tier + 1) }),
  settle: () => set({ settled: true }),
}))

export const qualityTier = () => TIERS[useQuality.getState().tier]
/** Antialiasing can't change after the canvas exists, so it follows the first guess. */
export const START_ANTIALIAS = START >= 1

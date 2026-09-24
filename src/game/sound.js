/**
 * Game sound effects, synthesised with Web Audio — no audio files to download.
 *
 * Every sound is built from two primitives: a filtered noise burst (rock, rubble,
 * whooshes) and an enveloped oscillator (thuds, chimes, coins). Browsers only allow
 * audio after a user gesture, so the context is created/resumed on the first click
 * or key press.
 */

const MUTE_KEY = 'mine.muted'
let ctx = null
let master = null
let noiseBuf = null
let muted = false
try {
  muted = localStorage.getItem(MUTE_KEY) === '1'
} catch {
  muted = false
}

/** Volume scale for the sound being played (other players' sounds are quieter). */
let scale = 1

/** Plays `fn` (an sfx call) at a fraction of full volume. */
export function withVolume(volume, fn) {
  if (volume <= 0.01) return
  const prev = scale
  scale = volume
  try {
    fn()
  } finally {
    scale = prev
  }
}

const listeners = new Set()
export const isMuted = () => muted
export function setMuted(value) {
  muted = value
  try {
    localStorage.setItem(MUTE_KEY, value ? '1' : '0')
  } catch {
    /* private mode: just don't persist */
  }
  if (master) master.gain.value = muted ? 0 : 0.55
  listeners.forEach((fn) => fn(muted))
}
export function onMuteChange(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function audio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return null
    ctx = new AC()
    master = ctx.createGain()
    master.gain.value = muted ? 0 : 0.55
    // A gentle compressor keeps stacked hits from clipping.
    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = -16
    comp.ratio.value = 4
    master.connect(comp).connect(ctx.destination)
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
    const data = noiseBuf.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  }
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

// Unlock audio on the first interaction.
if (typeof window !== 'undefined') {
  const unlock = () => {
    audio()
    window.removeEventListener('pointerdown', unlock)
    window.removeEventListener('keydown', unlock)
  }
  window.addEventListener('pointerdown', unlock)
  window.addEventListener('keydown', unlock)
}

/** Filtered noise burst with a fast attack and exponential decay. */
function noise({ dur = 0.2, type = 'lowpass', freq = 1200, freqEnd, q = 1, gain = 0.3, delay = 0 }) {
  const a = audio()
  if (!a || muted) return
  const t = a.currentTime + delay
  const src = a.createBufferSource()
  src.buffer = noiseBuf
  const filter = a.createBiquadFilter()
  filter.type = type
  filter.Q.value = q
  filter.frequency.setValueAtTime(freq, t)
  if (freqEnd) filter.frequency.exponentialRampToValueAtTime(freqEnd, t + dur)
  const g = a.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain * scale), t + 0.004)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  src.connect(filter).connect(g).connect(master)
  src.start(t, Math.random() * 0.5)
  src.stop(t + dur + 0.05)
}

/** Oscillator note with an optional pitch glide. */
function tone({ type = 'sine', freq = 440, freqEnd, dur = 0.2, gain = 0.2, delay = 0, attack = 0.005 }) {
  const a = audio()
  if (!a || muted) return
  const t = a.currentTime + delay
  const osc = a.createOscillator()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t)
  if (freqEnd) osc.frequency.exponentialRampToValueAtTime(freqEnd, t + dur)
  const g = a.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain * scale), t + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  osc.connect(g).connect(master)
  osc.start(t)
  osc.stop(t + dur + 0.05)
}

const vary = (x, amount = 0.12) => x * (1 + (Math.random() * 2 - 1) * amount)
let lastHit = 0

export const sfx = {
  /** Pickaxe biting into rock: low thud plus a gritty scrape. */
  hit() {
    const now = performance.now()
    if (now - lastHit < 45) return
    lastHit = now
    tone({ type: 'triangle', freq: vary(190), freqEnd: 60, dur: 0.13, gain: 0.4 })
    noise({ type: 'lowpass', freq: vary(2400), freqEnd: 350, dur: 0.1, gain: 0.32 })
    noise({ type: 'highpass', freq: 3500, dur: 0.03, gain: 0.12 })
  },

  /** The floor visibly cracking further: sharp crunch plus little ticks. */
  crack() {
    noise({ type: 'bandpass', freq: vary(2200), q: 1.5, dur: 0.16, gain: 0.45 })
    for (let i = 0; i < 4; i++) {
      noise({ type: 'highpass', freq: 3000, dur: 0.025, gain: 0.18, delay: 0.03 + i * 0.035 + Math.random() * 0.02 })
    }
    tone({ type: 'square', freq: vary(120), freqEnd: 70, dur: 0.08, gain: 0.08 })
  },

  /** A floor giving way: boom, falling rubble, then a little sparkle. */
  break() {
    tone({ type: 'sine', freq: 95, freqEnd: 32, dur: 0.6, gain: 0.7 })
    noise({ type: 'lowpass', freq: 3200, freqEnd: 180, dur: 0.8, gain: 0.55 })
    for (let i = 0; i < 10; i++) {
      noise({
        type: 'bandpass',
        freq: 700 + Math.random() * 2200,
        q: 3,
        dur: 0.05 + Math.random() * 0.06,
        gain: 0.14 + Math.random() * 0.12,
        delay: 0.08 + Math.random() * 0.55,
      })
    }
    ;[1318, 1760, 2637].forEach((f, i) => tone({ freq: f, dur: 0.25, gain: 0.09, delay: 0.18 + i * 0.07 }))
  },

  /** One footstep: a soft scuff, pitched a little differently each time. */
  step() {
    noise({ type: 'lowpass', freq: vary(620, 0.25), freqEnd: 180, dur: 0.07, gain: 0.16 })
    tone({ type: 'triangle', freq: vary(95, 0.2), freqEnd: 55, dur: 0.05, gain: 0.07 })
  },

  jump() {
    noise({ type: 'bandpass', freq: 500, freqEnd: 1400, q: 0.9, dur: 0.14, gain: 0.08 })
    tone({ type: 'sine', freq: 260, freqEnd: 520, dur: 0.12, gain: 0.07 })
  },

  /** Touching down after a jump or fall: harder the further you dropped. */
  land(strength = 1) {
    const k = Math.min(1.6, strength)
    noise({ type: 'lowpass', freq: 900, freqEnd: 140, dur: 0.12, gain: 0.2 * k })
    tone({ type: 'sine', freq: 110, freqEnd: 45, dur: 0.12, gain: 0.14 * k })
  },

  /** Training pad hit: a soft rising "power" blip. */
  train() {
    tone({ type: 'triangle', freq: vary(420, 0.05), freqEnd: 760, dur: 0.1, gain: 0.08 })
  },

  /** Quiet whoosh of the swing itself. */
  swing() {
    noise({ type: 'bandpass', freq: 700, freqEnd: 2400, q: 0.8, dur: 0.12, gain: 0.05 })
  },

  pickup() {
    tone({ freq: 520, freqEnd: 1100, dur: 0.14, gain: 0.25 })
    tone({ freq: 1568, dur: 0.12, gain: 0.08, delay: 0.09 })
  },

  /** Loot landing in the backpack. */
  stash() {
    noise({ type: 'lowpass', freq: 900, dur: 0.08, gain: 0.2 })
    tone({ type: 'triangle', freq: 330, freqEnd: 220, dur: 0.1, gain: 0.15 })
  },

  sell() {
    for (let k = 0; k < 3; k++) {
      tone({ type: 'triangle', freq: 1318, dur: 0.08, gain: 0.16, delay: k * 0.09 })
      tone({ type: 'triangle', freq: 1975, dur: 0.3, gain: 0.14, delay: k * 0.09 + 0.05 })
    }
  },

  buy() {
    ;[523, 659, 784, 1046].forEach((f, i) => tone({ type: 'triangle', freq: f, dur: 0.18, gain: 0.16, delay: i * 0.07 }))
  },

  levelUp() {
    ;[440, 554, 659, 880, 1109].forEach((f, i) => tone({ freq: f, dur: 0.22, gain: 0.16, delay: i * 0.06 }))
  },

  quest() {
    ;[523, 659, 784].forEach((f, i) => tone({ type: 'triangle', freq: f, dur: 0.15, gain: 0.15, delay: i * 0.1 }))
    ;[1046, 1318, 1568].forEach((f) => tone({ type: 'triangle', freq: f, dur: 0.5, gain: 0.1, delay: 0.3 }))
  },

  warn() {
    tone({ freq: 880, dur: 0.1, gain: 0.18 })
    tone({ freq: 880, dur: 0.1, gain: 0.18, delay: 0.17 })
  },

  error() {
    tone({ type: 'square', freq: 170, freqEnd: 120, dur: 0.18, gain: 0.08 })
  },

  rare() {
    ;[784, 988, 1175, 1568, 1976].forEach((f, i) => tone({ freq: f, dur: 0.3, gain: 0.12, delay: i * 0.05 }))
  },
}

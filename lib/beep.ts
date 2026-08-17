"use client"

/** Tiny WebAudio beeps for POS feedback (no audio assets needed). */

let ctx: AudioContext | null = null
let unlocked = false

type Ctor = typeof AudioContext

function makeCtx(): AudioContext | null {
  try {
    if (!ctx) {
      const AC: Ctor | undefined =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: Ctor }).webkitAudioContext
      if (!AC) return null
      ctx = new AC()
    }
    return ctx
  } catch {
    return null
  }
}

function getCtx(): AudioContext | null {
  const c = makeCtx()
  if (c && c.state === "suspended") void c.resume()
  return c
}

/**
 * Create + resume the AudioContext and play a 1-sample silent buffer. On iOS/
 * Safari this MUST run inside a real user gesture the first time, or the context
 * stays muted forever — which is why a barcode scan (not a gesture) later makes
 * no sound. We drive it from the global listeners below so the first tap
 * anywhere unlocks audio for every later beep.
 */
export function unlockAudio() {
  const c = makeCtx()
  if (!c) return
  if (c.state === "suspended") void c.resume()
  if (!unlocked) {
    try {
      const buf = c.createBuffer(1, 1, 22050)
      const src = c.createBufferSource()
      src.buffer = buf
      src.connect(c.destination)
      src.start(0)
      unlocked = true
    } catch {
      /* ignore */
    }
  }
}

/** Call from a user gesture (click) so mobile browsers unlock audio. */
export function ensureAudio() {
  unlockAudio()
}

// Unlock on the FIRST real interaction anywhere, regardless of which screen
// mounted first. This is what makes the scan beep reliable on phones.
if (typeof window !== "undefined") {
  const evs = ["pointerdown", "touchend", "mousedown", "keydown"] as const
  const kick = () => {
    unlockAudio()
    if (unlocked) evs.forEach((e) => window.removeEventListener(e, kick))
  }
  evs.forEach((e) => window.addEventListener(e, kick, { passive: true }))
}

/* Mute preference (persisted; sound is ON by default). */
const MUTE_KEY = "alrahmah_muted"

export function isMuted(): boolean {
  try {
    return window.localStorage.getItem(MUTE_KEY) === "1"
  } catch {
    return false
  }
}

export function setMuted(muted: boolean) {
  try {
    window.localStorage.setItem(MUTE_KEY, muted ? "1" : "0")
  } catch {
    /* ignore */
  }
}

// Optional exact sound: drop a file at public/sounds/scan.mp3 and it's used
// instead of the synthesized tone (checked once, cached).
let customSound: HTMLAudioElement | null | undefined
function getCustomSound(): HTMLAudioElement | null {
  if (customSound !== undefined) return customSound
  customSound = null
  try {
    const a = new Audio("/sounds/scan.mp3")
    a.preload = "auto"
    a.addEventListener("canplaythrough", () => {
      customSound = a
    })
    a.load()
  } catch {
    /* no file / no audio */
  }
  return customSound
}

/**
 * The classic supermarket-scanner "BEEP" (Datalogic/Zebra style): a clean,
 * glassy ~3.6 kHz tone with a hard attack, flat body and quick stop.
 * Failure = short low buzz.
 */
export function playBeep(ok = true, volume = 1) {
  if (isMuted()) return
  if (ok) {
    const custom = getCustomSound()
    if (custom) {
      try {
        custom.currentTime = 0
        custom.volume = Math.max(0, Math.min(1, volume))
        void custom.play()
        return
      } catch {
        /* fall back to synth */
      }
    }
  }
  const c = getCtx()
  if (!c) return
  try {
    const t = c.currentTime
    const gain = c.createGain()
    gain.connect(c.destination)
    if (ok) {
      const dur = 0.15
      // Fundamental + faint harmonic = piezo "glassy" body.
      const o1 = c.createOscillator()
      o1.type = "sine"
      o1.frequency.setValueAtTime(3620, t)
      const o2 = c.createOscillator()
      o2.type = "sine"
      o2.frequency.setValueAtTime(7240, t)
      const g2 = c.createGain()
      g2.gain.value = 0.12
      o2.connect(g2)
      g2.connect(gain)
      o1.connect(gain)
      const peak = 0.3 * volume
      gain.gain.setValueAtTime(0.0001, t)
      gain.gain.exponentialRampToValueAtTime(peak, t + 0.005) // hard attack
      gain.gain.setValueAtTime(peak, t + dur - 0.03) // flat body
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur) // quick stop
      o1.start(t)
      o2.start(t)
      o1.stop(t + dur + 0.02)
      o2.stop(t + dur + 0.02)
    } else {
      const osc = c.createOscillator()
      osc.type = "square"
      osc.frequency.setValueAtTime(180, t)
      gain.gain.setValueAtTime(0.0001, t)
      gain.gain.exponentialRampToValueAtTime(0.12 * volume, t + 0.005)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.2)
      osc.connect(gain)
      osc.start(t)
      osc.stop(t + 0.22)
    }
  } catch {
    /* audio unavailable — vibration/toast still give feedback */
  }
}

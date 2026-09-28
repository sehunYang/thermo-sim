import type { GasConfig, GasState } from './gas'
import { energy, type Energy } from './processes'
import { stateAt, type ResolvedSegment } from './path'

export interface Playhead {
  segmentIndex: number
  s: number // progress of the free variable within the segment, 0..1
  playing: boolean
  speed: number
  loop: boolean
}

/** Default seconds per segment at 1× speed. */
export const SEGMENT_SECONDS = 3

/**
 * Smoothstep timing: the free variable speeds up and slows down within each segment, so the
 * piston is at rest at every segment boundary. s = easeS(τ) with τ the segment's elapsed time.
 */
export const easeS = (t: number): number => t * t * (3 - 2 * t)

/** Inverse of easeS on [0, 1], by Newton iteration. */
export function invEase(s: number): number {
  let t = s
  for (let i = 0; i < 8; i++) {
    const d = 6 * t * (1 - t)
    if (d < 1e-6) break
    t = Math.min(1, Math.max(0, t - (easeS(t) - s) / d))
  }
  return t
}

/** ds/dτ of the smoothstep timing. */
export const easeRate = (t: number): number => 6 * t * (1 - t)

export interface Instant {
  state: GasState
  /** Energy exchanged from the segment start up to now. */
  sofar: Energy
  /** Rates per unit τ (segment time fraction), J per segment-duration. */
  dQ: number
  dW: number
}

/** Instantaneous view of a segment at progress s, with rates taken over the segment's time. */
export function instantAt(gas: GasConfig, r: ResolvedSegment, s: number): Instant {
  const st = stateAt(gas, r, s)
  const sofar = energy(gas, r.segment.type, r.a, st)
  const h = 1e-3
  const s0 = Math.max(0, s - h)
  const s1 = Math.min(1, s + h)
  const e0 = energy(gas, r.segment.type, r.a, stateAt(gas, r, s0))
  const e1 = energy(gas, r.segment.type, r.a, stateAt(gas, r, s1))
  const rate = easeRate(invEase(s)) / (s1 - s0)
  return { state: st, sofar, dQ: (e1.Q - e0.Q) * rate, dW: (e1.W - e0.W) * rate }
}

/**
 * Advance the playhead by dt seconds. Time within a segment is τ; s follows easeS(τ).
 * Returns a new playhead; playback stops at the end unless loop is on.
 */
export function advance(p: Playhead, dt: number, segmentCount: number): Playhead {
  if (!p.playing || segmentCount === 0) return p
  let seg = p.segmentIndex
  let tau = invEase(p.s) + (dt * p.speed) / SEGMENT_SECONDS
  while (tau >= 1) {
    tau -= 1
    seg += 1
    if (seg >= segmentCount) {
      if (!p.loop) return { ...p, segmentIndex: segmentCount - 1, s: 1, playing: false }
      seg = 0
    }
  }
  return { ...p, segmentIndex: seg, s: easeS(tau) }
}

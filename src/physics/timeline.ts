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

/** Average seconds per segment at 1× speed: a path of n segments plays in n × this. */
export const SEGMENT_SECONDS = 3

/**
 * An adiabatic segment exchanges no heat, so nothing holds it back: in a real engine it is over
 * in milliseconds, thousands of times faster than heat can cross a wall. Shown at this length.
 */
export const ADIABATIC_SECONDS = 0.6

/** Shortest time for a segment that exchanges heat, so a small step can still be watched. */
export const MIN_HEAT_SECONDS = 1

/**
 * Seconds each segment takes at 1× speed. Heat crosses the wall at Q̇ = K·ΔT with a small,
 * fixed temperature gap ΔT, so a segment that exchanges heat takes t = |Q|/(K·ΔT), proportional
 * to |Q|. Adiabatic segments take ADIABATIC_SECONDS. K·ΔT is chosen so the whole path keeps
 * SEGMENT_SECONDS per segment on average. A path with no heat at all keeps equal shares.
 */
export function segmentDurations(segs: { segment: { type: string }; energy: { Q: number } }[]) {
  const n = segs.length
  const heat = segs.map((r) => r.segment.type !== 'adiabatic')
  const nHeat = heat.filter(Boolean).length
  if (nHeat === 0) return segs.map(() => SEGMENT_SECONDS)
  const budget = n * SEGMENT_SECONDS - (n - nHeat) * ADIABATIC_SECONDS
  // Proportional to |Q|. A segment whose share would fall under MIN_HEAT_SECONDS gets the floor
  // and the others share what is left, until no share falls under it.
  const floored = new Set<number>()
  for (;;) {
    const free = segs.flatMap((_, i) => (heat[i] && !floored.has(i) ? [i] : []))
    const left = budget - floored.size * MIN_HEAT_SECONDS
    const q = free.reduce((sum, i) => sum + Math.abs(segs[i].energy.Q), 0)
    const share = (i: number) =>
      q > 0 ? (left * Math.abs(segs[i].energy.Q)) / q : left / free.length
    const low = free.filter((i) => share(i) < MIN_HEAT_SECONDS)
    if (low.length === 0 || low.length === free.length)
      return segs.map((_, i) =>
        !heat[i]
          ? ADIABATIC_SECONDS
          : floored.has(i)
            ? MIN_HEAT_SECONDS
            : Math.max(share(i), MIN_HEAT_SECONDS),
      )
    low.forEach((i) => floored.add(i))
  }
}

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
export function advance(p: Playhead, dt: number, durations: number[]): Playhead {
  const segmentCount = durations.length
  if (!p.playing || segmentCount === 0) return p
  let seg = p.segmentIndex
  let left = dt * p.speed
  let tau = invEase(p.s)
  for (;;) {
    const rest = (1 - tau) * durations[seg]
    if (left < rest) {
      tau += left / durations[seg]
      break
    }
    left -= rest
    tau = 0
    seg += 1
    if (seg >= segmentCount) {
      if (!p.loop) return { ...p, segmentIndex: segmentCount - 1, s: 1, playing: false }
      seg = 0
    }
  }
  return { ...p, segmentIndex: seg, s: easeS(tau) }
}

/**
 * Heat the gas has taken in and given out since the start of the cycle, up to segment seg at
 * progress s (both ≥ 0). Within one of the four processes Q never changes sign, so a segment's
 * partial heat goes wholly to one side.
 */
export function heatSoFar(
  gas: GasConfig,
  segs: ResolvedSegment[],
  seg: number,
  s: number,
): { qin: number; qout: number } {
  let qin = 0
  let qout = 0
  const add = (q: number) => (q > 0 ? (qin += q) : (qout -= q))
  for (let i = 0; i < Math.min(seg, segs.length); i++) add(segs[i].energy.Q)
  const r = segs[seg]
  if (r && s > 0) add(energy(gas, r.segment.type, r.a, stateAt(gas, r, s)).Q)
  return { qin, qout }
}

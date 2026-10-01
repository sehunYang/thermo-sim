import type { GasConfig, GasState, ProcessType } from './gas'
import { energy, endState, state, stateBetween, type Energy } from './processes'

export interface Segment {
  id: string
  type: ProcessType
  end: number // P₂ for isochoric, V₂ otherwise
}

export interface ProcessPath {
  gas: GasConfig
  start: { P: number; V: number }
  segments: Segment[]
  closed: boolean
}

/** A segment with its computed start and end states. Never stored, always derived from the path. */
export interface ResolvedSegment {
  index: number
  segment: Segment
  a: GasState
  b: GasState
  energy: Energy
}

export const LIMITS = {
  Vmin: 0.5,
  Vmax: 50,
  Pmin: 5,
  Pmax: 500,
  Tmin: 50,
  Tmax: 2500,
} as const

export function isValidState(s: GasState): boolean {
  return (
    s.V >= LIMITS.Vmin &&
    s.V <= LIMITS.Vmax &&
    s.P >= LIMITS.Pmin &&
    s.P <= LIMITS.Pmax &&
    s.T >= LIMITS.Tmin &&
    s.T <= LIMITS.Tmax
  )
}

export function resolve(path: ProcessPath): ResolvedSegment[] {
  const { gas } = path
  const start = state(gas, path.start.P, path.start.V)
  const out: ResolvedSegment[] = []
  let a = start
  path.segments.forEach((segment, index) => {
    const last = index === path.segments.length - 1
    // A closed path ends exactly on the start state, whatever rounding the last end value carries.
    const b = path.closed && last ? start : endState(gas, segment.type, a, segment.end)
    out.push({ index, segment, a, b, energy: energy(gas, segment.type, a, b) })
    a = b
  })
  return out
}

export function stateAt(gas: GasConfig, r: ResolvedSegment, s: number): GasState {
  return stateBetween(gas, r.segment.type, r.a, r.b, s)
}

/** Every sampled state of every segment stays inside the graph range and allowed temperatures. */
export function isValidPath(path: ProcessPath, samples = 20): boolean {
  return resolve(path).every((r) => {
    for (let k = 0; k <= samples; k++)
      if (!isValidState(stateAt(path.gas, r, k / samples))) return false
    return true
  })
}

/**
 * Reservoir temperatures the second law allows. Heat only flows from hot to cold, so the source
 * of every heat-absorbing segment must be at least as hot as the gas ever gets there, and the
 * sink of every heat-rejecting segment at most as hot as the gas ever gets there:
 * T_src = max T over absorbing segments, T_sink = min T over rejecting ones (null when none).
 */
export interface ReservoirTemps {
  Tsrc: number | null
  Tsink: number | null
}

/** Below this |Q| a segment counts as exchanging no heat (rounding of a closing segment). */
const Q_EPS = 0.5

export function reservoirTemps(path: ProcessPath, samples = 20): ReservoirTemps {
  let Tsrc: number | null = null
  let Tsink: number | null = null
  for (const r of resolve(path)) {
    const Q = r.energy.Q
    if (r.segment.type === 'adiabatic' || Math.abs(Q) < Q_EPS) continue
    for (let k = 0; k <= samples; k++) {
      const { T } = stateAt(path.gas, r, k / samples)
      if (Q > 0) Tsrc = Math.max(Tsrc ?? -Infinity, T)
      else Tsink = Math.min(Tsink ?? Infinity, T)
    }
  }
  return { Tsrc, Tsink }
}

interface CycleTotals {
  sumDU: number
  /** Heat-source and heat-sink temperatures (see reservoirTemps). */
  Tsrc: number
  Tsink: number
}

export type CycleAnalysis =
  | (CycleTotals & {
      kind: 'engine'
      Wnet: number
      Qin: number
      /** Heat rejected, as a positive amount. */
      Qout: number
      efficiency: number
      carnotEfficiency: number
    })
  | (CycleTotals & {
      kind: 'refrigerator'
      Win: number
      Qc: number
      Qh: number
      cop: number
      carnotCop: number
    })
  | (CycleTotals & {
      /** Work goes in, yet heat only runs downhill: nothing is pumped out of a cold place. */
      kind: 'dissipative'
      Win: number
      Qin: number
      Qout: number
    })

/**
 * Cycle totals for a closed path; null for an open one. No process changes the sign of Q within
 * a segment, so Q_in and Q_out can be summed segment by segment. The Carnot limits use the
 * reservoir temperatures, so η ≤ η_C and COP ≤ COP_C always hold (Clausius inequality).
 */
export function analyzeCycle(path: ProcessPath): CycleAnalysis | null {
  if (!path.closed) return null
  const segs = resolve(path)
  if (!segs.length) return null
  let Wnet = 0
  let Qin = 0
  let Qout = 0
  let sumDU = 0
  for (const { energy: e } of segs) {
    Wnet += e.W
    sumDU += e.dU
    if (e.Q > 0) Qin += e.Q
    else Qout -= e.Q
  }
  const { Tsrc, Tsink } = reservoirTemps(path)
  const temps = { sumDU, Tsrc: Tsrc ?? 0, Tsink: Tsink ?? 0 }
  if (Wnet >= 0)
    return {
      kind: 'engine',
      ...temps,
      Wnet,
      Qin,
      Qout,
      efficiency: Qin > 0 ? Wnet / Qin : 0,
      carnotEfficiency: Tsrc && Tsink ? 1 - Tsink / Tsrc : 0,
    }
  const Win = -Wnet
  if (Tsrc != null && Tsink != null && Tsrc < Tsink)
    return {
      kind: 'refrigerator',
      ...temps,
      Win,
      Qc: Qin,
      Qh: Qout,
      cop: Qin / Win,
      carnotCop: Tsrc / (Tsink - Tsrc),
    }
  return { kind: 'dissipative', ...temps, Win, Qin, Qout }
}

export type ReservoirSide = 'hot' | 'cold'

/**
 * Which reservoir each segment's copper bridge touches (null for adiabatic or negligible heat),
 * from the sign of Q alone. A refrigerator absorbs from its cold side (the room) and rejects to
 * its hot side (outdoors); everything else absorbs from the hot side.
 */
export function reservoirSides(path: ProcessPath): (ReservoirSide | null)[] {
  const fridge = analyzeCycle(path)?.kind === 'refrigerator'
  return resolve(path).map(({ segment, energy: e }) => {
    if (segment.type === 'adiabatic' || Math.abs(e.Q) < Q_EPS) return null
    return e.Q > 0 === !fridge ? 'hot' : 'cold'
  })
}

/** Temperature to label each reservoir box with, for a closed path (null otherwise). */
export function reservoirLabels(path: ProcessPath): { hot: number; cold: number } | null {
  const c = analyzeCycle(path)
  if (!c || !c.Tsrc || !c.Tsink) return null
  return c.kind === 'refrigerator' ? { hot: c.Tsink, cold: c.Tsrc } : { hot: c.Tsrc, cold: c.Tsink }
}

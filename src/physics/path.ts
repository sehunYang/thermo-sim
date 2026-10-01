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

export interface TemperatureRange {
  Tmin: number
  Tmax: number
}

export function temperatureRange(path: ProcessPath, samples = 20): TemperatureRange | null {
  const segs = resolve(path)
  if (!segs.length) return null
  let Tmin = Infinity
  let Tmax = -Infinity
  for (const r of segs)
    for (let k = 0; k <= samples; k++) {
      const { T } = stateAt(path.gas, r, k / samples)
      Tmin = Math.min(Tmin, T)
      Tmax = Math.max(Tmax, T)
    }
  return { Tmin, Tmax }
}

export type CycleAnalysis =
  | {
      kind: 'engine'
      Wnet: number
      Qin: number
      Qout: number
      sumDU: number
      efficiency: number
      carnotEfficiency: number
      Tmin: number
      Tmax: number
    }
  | {
      kind: 'refrigerator'
      Win: number
      Qc: number
      Qh: number
      sumDU: number
      cop: number
      carnotCop: number
      Tmin: number
      Tmax: number
    }

/**
 * Cycle totals for a closed path; null for an open one. No process changes the sign of Q within
 * a segment, so Q_in and Q_out can be summed segment by segment.
 */
export function analyzeCycle(path: ProcessPath): CycleAnalysis | null {
  if (!path.closed) return null
  const segs = resolve(path)
  const range = temperatureRange(path)
  if (!segs.length || !range) return null
  let Wnet = 0
  let Qin = 0
  let Qout = 0
  let sumDU = 0
  for (const { energy: e } of segs) {
    Wnet += e.W
    sumDU += e.dU
    if (e.Q > 0) Qin += e.Q
    else Qout += e.Q
  }
  const { Tmin, Tmax } = range
  if (Wnet >= 0)
    return {
      kind: 'engine',
      Wnet,
      Qin,
      Qout,
      sumDU,
      efficiency: Qin > 0 ? Wnet / Qin : 0,
      carnotEfficiency: 1 - Tmin / Tmax,
      Tmin,
      Tmax,
    }
  const Win = -Wnet
  return {
    kind: 'refrigerator',
    Win,
    Qc: Qin,
    Qh: -Qout,
    sumDU,
    cop: Win > 0 ? Qin / Win : 0,
    carnotCop: Tmin / (Tmax - Tmin),
    Tmin,
    Tmax,
  }
}

export type ReservoirSide = 'hot' | 'cold'

/**
 * Which reservoir each segment's copper bridge touches (null for adiabatic or negligible heat).
 * In a closed cycle the segment's mean temperature is compared with the cycle's mid temperature
 * (outside a 5% band), so a refrigerator absorbs from the cold side; otherwise the sign of Q decides.
 */
export function reservoirSides(path: ProcessPath): (ReservoirSide | null)[] {
  const segs = resolve(path)
  const range = temperatureRange(path)
  if (!range) return []
  const mid = (range.Tmin + range.Tmax) / 2
  const band = (range.Tmax - range.Tmin) * 0.05
  return segs.map(({ segment, a, b, energy: e }) => {
    if (segment.type === 'adiabatic' || Math.abs(e.Q) < 0.5) return null
    if (path.closed) {
      const avg = (a.T + b.T) / 2
      if (Math.abs(avg - mid) > band) return avg > mid ? 'hot' : 'cold'
    }
    return e.Q > 0 ? 'hot' : 'cold'
  })
}

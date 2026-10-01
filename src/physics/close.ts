import type { GasConfig, GasState, ProcessType } from './gas'
import { LIMITS, isValidPath, resolve, type ProcessPath } from './path'
import { endState } from './processes'

/** A new segment as the editor stores it, before it gets an id. */
export interface NewSegment {
  type: ProcessType
  end: number
}

/** A way to close an open path back onto its start state A. */
export interface Closure {
  /** New free value for the last drawn segment, or null when it stays as drawn. */
  adjust: number | null
  /** Segments appended after the last drawn one; the final one ends on A. */
  add: NewSegment[]
  /** How far the closure moves or travels, in the metric it was chosen with. */
  cost: number
}

export type Metric = (a: { P: number; V: number }, b: { P: number; V: number }) => number

/** Distance as a fraction of the graph's axes, which is proportional to distance on screen. */
export const graphMetric: Metric = (a, b) =>
  Math.hypot((a.V - b.V) / LIMITS.Vmax, (a.P - b.P) / LIMITS.Pmax)

/** The quantity a process keeps fixed, in log form so curves of very different scale compare. */
function invariant(gas: GasConfig, type: ProcessType, s: { P: number; V: number }): number {
  if (type === 'isochoric') return Math.log(s.V)
  if (type === 'isobaric') return Math.log(s.P)
  if (type === 'isothermal') return Math.log(s.P * s.V)
  return Math.log(s.P) + gas.gamma * Math.log(s.V)
}

/** Free value of a segment ending on state s (P₂ for isochoric, V₂ otherwise). */
export const freeValue = (type: ProcessType, s: { P: number; V: number }) =>
  type === 'isochoric' ? s.P : s.V

/** Too small a change to count as a segment; the editor refuses the same. */
export const tooSmall = (a: { P: number; V: number }, b: { P: number; V: number }) =>
  Math.abs(b.V - a.V) < 0.25 && Math.abs(b.P - a.P) < 2.5

/**
 * Free values e of a `type` segment starting at `from` whose end state lies on the `target`
 * curve through `through`. Found by sampling the free variable's range and bisecting each sign
 * change; empty when the two curves are of the same kind.
 */
export function meetCurve(
  gas: GasConfig,
  type: ProcessType,
  from: GasState,
  target: ProcessType,
  through: { P: number; V: number },
): number[] {
  if (type === target) return []
  const goal = invariant(gas, target, through)
  const h = (e: number) => invariant(gas, target, endState(gas, type, from, e)) - goal
  const [lo, hi]: [number, number] =
    type === 'isochoric' ? [LIMITS.Pmin, LIMITS.Pmax] : [LIMITS.Vmin, LIMITS.Vmax]
  const N = 400
  const roots: number[] = []
  let e0 = lo
  let h0 = h(e0)
  for (let i = 1; i <= N; i++) {
    const e1 = lo + ((hi - lo) * i) / N
    const h1 = h(e1)
    if (h0 === 0) roots.push(e0)
    else if (h0 * h1 < 0) {
      let a = e0
      let b = e1
      let ha = h0
      for (let k = 0; k < 60; k++) {
        const m = (a + b) / 2
        const hm = h(m)
        if (ha * hm <= 0) b = m
        else {
          a = m
          ha = hm
        }
      }
      roots.push((a + b) / 2)
    }
    e0 = e1
    h0 = h1
  }
  if (h0 === 0) roots.push(e0)
  return roots
}

function acceptable(path: ProcessPath, adjust: number | null, add: NewSegment[]): boolean {
  const segments = path.segments.map((s, i) =>
    adjust != null && i === path.segments.length - 1 ? { ...s, end: adjust } : s,
  )
  const trial: ProcessPath = {
    ...path,
    segments: [...segments, ...add.map((s, i) => ({ id: `c${i}`, ...s }))],
    closed: true,
  }
  if (!isValidPath(trial)) return false
  return resolve(trial).every((r) => !tooSmall(r.a, r.b))
}

/**
 * Close the path with one `type` segment into A, moving the last drawn state along its own curve
 * onto the `type` curve through A. Picks the nearest such point; null when none works.
 */
export function closeWith(
  path: ProcessPath,
  type: ProcessType,
  metric: Metric = graphMetric,
): Closure | null {
  if (path.closed || !path.segments.length) return null
  const segs = resolve(path)
  const last = segs[segs.length - 1]
  const A = path.start
  let best: Closure | null = null
  for (const e of meetCurve(path.gas, last.segment.type, last.a, type, A)) {
    const X = endState(path.gas, last.segment.type, last.a, e)
    const add = [{ type, end: freeValue(type, A) }]
    if (!acceptable(path, e, add)) continue
    const cost = metric(X, last.b)
    if (!best || cost < best.cost) best = { adjust: e, add, cost }
  }
  return best
}

/**
 * The best way back to A. First the one closing process that needs the smallest move of the
 * last state; failing that (for example after a single segment, whose curve already runs through
 * A), two new segments from the last state with the shortest detour.
 */
export function autoClose(path: ProcessPath, metric: Metric = graphMetric): Closure | null {
  if (path.closed || !path.segments.length) return null
  const types: ProcessType[] = ['isochoric', 'isobaric', 'isothermal', 'adiabatic']
  let best: Closure | null = null
  for (const t of types) {
    const c = closeWith(path, t, metric)
    if (c && (!best || c.cost < best.cost)) best = c
  }
  if (best) return best

  const segs = resolve(path)
  const last = segs[segs.length - 1]
  const X = last.b
  const A = path.start
  for (const t1 of types) {
    if (t1 === last.segment.type) continue
    for (const t2 of types) {
      for (const e of meetCurve(path.gas, t1, X, t2, A)) {
        const M = endState(path.gas, t1, X, e)
        const add = [
          { type: t1, end: e },
          { type: t2, end: freeValue(t2, A) },
        ]
        if (!acceptable(path, null, add)) continue
        const cost = metric(X, M) + metric(M, A)
        if (!best || cost < best.cost) best = { adjust: null, add, cost }
      }
    }
  }
  return best
}

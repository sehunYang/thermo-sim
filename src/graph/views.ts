import { R, cv, temperature, type GasConfig, type GasState, type ProcessType } from '../physics/gas'
import { LIMITS } from '../physics/path'
import { endState } from '../physics/processes'
import { G, PH, PW } from './geometry'

/** Which pair of state variables the graph plots: P-V, P-T or T-S. */
export type PlaneId = 'PV' | 'PT' | 'TS'
export const PLANES: PlaneId[] = ['PV', 'PT', 'TS']
export const PLANE_NAME: Record<PlaneId, string> = { PV: 'P-V', PT: 'P-T', TS: 'T-S' }

export interface Axis {
  min: number
  max: number
  /** Light grid lines. */
  grid: number[]
  /** Numbered ticks. */
  labels: number[]
  title: string
}

/**
 * One plane of the graph. Every plane draws the same states: a point is placed or edited by the
 * process's own free value (P₂ or V₂), so a cycle edited in any plane is the same cycle in all.
 */
export interface Plane {
  id: PlaneId
  x: Axis
  y: Axis
  /** Axis values (x, y) of the state with pressure P and volume V. */
  val(P: number, V: number): [number, number]
  /** The state at axis values (x, y), or null where the plane alone cannot fix one. */
  at(x: number, y: number): GasState | null
  /** Processes whose line is curved or slanted here, so the pointer may be well off it. */
  curved: ProcessType[]
  /** What the area under a path means here: work (P-V), heat (T-S) or nothing (P-T). */
  area: 'W' | 'Q' | null
}

export const toX = (a: Axis, v: number) => G.L + ((v - a.min) / (a.max - a.min)) * PW
export const toY = (a: Axis, v: number) => G.T + PH - ((v - a.min) / (a.max - a.min)) * PH
export const fromX = (a: Axis, x: number) => a.min + ((x - G.L) / PW) * (a.max - a.min)
export const fromY = (a: Axis, y: number) => a.min + ((G.T + PH - y) / PH) * (a.max - a.min)

/** Pixel position of the state (P, V) in a plane. */
export const px = (pl: Plane, P: number, V: number): [number, number] => {
  const [x, y] = pl.val(P, V)
  return [toX(pl.x, x), toY(pl.y, y)]
}

const range = (from: number, to: number, step: number) => {
  const out: number[] = []
  for (let k = Math.ceil(from / step - 1e-9); k * step <= to + 1e-9; k++) out.push(k * step)
  return out
}

/** A 1, 2, 2.5 or 5 × 10ⁿ step near span / n. */
function niceStep(span: number, n = 5) {
  const raw = span / n
  const p = Math.pow(10, Math.floor(Math.log10(raw)))
  for (const m of [1, 2, 2.5, 5]) if (m * p >= raw) return m * p
  return 10 * p
}

function axis(min: number, max: number, title: string, labelStep: number, gridStep: number): Axis {
  return {
    min,
    max,
    title,
    grid: range(min, max, gridStep).filter((v) => v > min),
    labels: range(min, max, labelStep),
  }
}

/** Entropy relative to the reference state ref (S_ref = 0), J/K. */
export function entropy(gas: GasConfig, ref: { P: number; V: number }, P: number, V: number) {
  const T = temperature(gas, P, V)
  const Tr = temperature(gas, ref.P, ref.V)
  return gas.n * cv(gas) * Math.log(T / Tr) + gas.n * R * Math.log(V / ref.V)
}

/** Temperature axis from 0 K with room above the hottest state drawn. */
function tAxis(Tmax: number) {
  const top = [600, 1000, 1500, 2000, 2500, 3000].find((t) => t >= Tmax * 1.3) ?? 3000
  const step = niceStep(top)
  return axis(0, top, '온도 T (K)', step, step / 2)
}

/** The corner where the axes meet holds the plane button, so the x axis numbers start after it. */
const xAxis = (a: Axis): Axis => ({ ...a, labels: a.labels.filter((v) => v > a.min) })

const P_AXIS = axis(0, LIMITS.Pmax, '압력 P (kPa)', 100, 50)

/**
 * Builds a plane for the gas, the start state A (needed for entropy) and the states drawn so far
 * (the T and S axes grow to fit them, with room to draw on).
 */
export function makePlane(
  id: PlaneId,
  gas: GasConfig,
  A: { P: number; V: number } | null,
  states: { P: number; V: number }[],
): Plane {
  const T = (P: number, V: number) => temperature(gas, P, V)
  if (id === 'PV')
    return {
      id,
      x: xAxis(axis(0, LIMITS.Vmax, '부피 V (L)', 10, 5)),
      y: P_AXIS,
      val: (P, V) => [V, P],
      at: (V, P) => ({ P, V, T: T(P, V) }),
      curved: ['isothermal', 'adiabatic'],
      area: 'W',
    }
  const Tmax = Math.max(460, ...states.map((s) => T(s.P, s.V)))
  if (id === 'PT')
    return {
      id,
      x: xAxis(tAxis(Tmax)),
      y: P_AXIS,
      val: (P, V) => [T(P, V), P],
      at: (t, P) => (t > 0 && P > 0 ? { P, V: (gas.n * R * t) / P, T: t } : null),
      curved: ['isochoric', 'adiabatic'],
      area: null,
    }
  const S = (P: number, V: number) => (A ? entropy(gas, A, P, V) : 0)
  const Ss = states.map((s) => S(s.P, s.V))
  const lo = Math.min(0, ...Ss)
  const hi = Math.max(0, ...Ss)
  const span = Math.max(hi - lo, 10)
  const pad = Math.max(5, span * 0.3)
  const step = niceStep(span + 2 * pad)
  const min = Math.floor((lo - pad) / step) * step
  const max = Math.ceil((hi + pad) / step) * step
  return {
    id,
    x: xAxis(axis(min, max, '엔트로피 S (J/K) · A에서 0', step, step / 2)),
    y: tAxis(Tmax),
    val: (P, V) => [S(P, V), T(P, V)],
    at: (s, t) => {
      if (!A || t <= 0) return null
      // S = n·Cv·ln(T/T_A) + n·R·ln(V/V_A), solved for V.
      const V = A.V * Math.exp((s - gas.n * cv(gas) * Math.log(t / T(A.P, A.V))) / (gas.n * R))
      return { P: (gas.n * R * t) / V, V, T: t }
    },
    curved: ['isochoric', 'isobaric'],
    area: 'Q',
  }
}

/** The whole line of a process through state a, over the graph's range of its free value. */
export function processLine(gas: GasConfig, type: ProcessType, a: GasState, n = 80): GasState[] {
  const [lo, hi] = type === 'isochoric' ? [LIMITS.Pmin, LIMITS.Pmax] : [LIMITS.Vmin, LIMITS.Vmax]
  return Array.from({ length: n + 1 }, (_, i) =>
    endState(gas, type, a, lo * Math.pow(hi / lo, i / n)),
  )
}

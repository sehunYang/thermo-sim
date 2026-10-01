import { R, temperature, type GasConfig, type GasState, type ProcessType } from '../physics/gas'
import { LIMITS, isValidState } from '../physics/path'
import { curveP, stateBetween } from '../physics/processes'

/** SVG viewBox layout of the PV graph (viewBox 0 0 W H). */
export const G = { L: 58, R: 18, T: 16, B: 46, W: 560, H: 440 } as const
export const PW = G.W - G.L - G.R
export const PH = G.H - G.T - G.B
export const VMAX = LIMITS.Vmax
export const PMAX = LIMITS.Pmax

export const xV = (V: number) => G.L + (V / VMAX) * PW
export const yP = (P: number) => G.T + PH - (P / PMAX) * PH
export const Vx = (x: number) => ((x - G.L) / PW) * VMAX
export const Py = (y: number) => ((G.T + PH - y) / PH) * PMAX

export const snapV = (v: number, off = false) => (off ? v : Math.round(v * 2) / 2)
export const snapP = (p: number, off = false) => (off ? p : Math.round(p / 5) * 5)

export type Pt = [number, number]

export function sampleSegment(
  gas: GasConfig,
  type: ProcessType,
  a: GasState,
  b: GasState,
  s0 = 0,
  s1 = 1,
  n = 48,
): Pt[] {
  const pts: Pt[] = []
  for (let i = 0; i <= n; i++) {
    const st = stateBetween(gas, type, a, b, s0 + ((s1 - s0) * i) / n)
    pts.push([xV(st.V), yP(Math.min(st.P, PMAX * 1.2))])
  }
  return pts
}

export const pathD = (pts: Pt[]) =>
  'M' + pts.map((p) => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join('L')

/** Isotherm through temperature T over the graph's volume range. */
export function isothermPts(gas: GasConfig, T: number): Pt[] {
  const pts: Pt[] = []
  for (let i = 0; i <= 80; i++) {
    const V = 1 + (i * (VMAX - 1)) / 80
    pts.push([xV(V), yP((gas.n * R * T) / V)])
  }
  return pts
}

export function adiabatPts(gas: GasConfig, through: GasState): Pt[] {
  const pts: Pt[] = []
  for (let i = 0; i <= 80; i++) {
    const V = 1 + (i * (VMAX - 1)) / 80
    pts.push([xV(V), yP(through.P * Math.pow(through.V / V, gas.gamma))])
  }
  return pts
}

export interface Ghost {
  type: ProcessType
  end: number
  a: GasState
  b: GasState
  valid: boolean
  closing: boolean
  why: string
}

/**
 * The preview segment from the current end state a, constrained to the tool's curve.
 * Isochoric follows the pointer's pressure, isobaric its volume; isothermal and adiabatic take the
 * point on the curve nearest the pointer on screen. Near the start state A (with at least two
 * segments drawn) the ghost snaps onto A and closes the cycle.
 */
export function computeGhost(opts: {
  gas: GasConfig
  tool: ProcessType
  a: GasState
  start: { P: number; V: number }
  segmentCount: number
  V: number
  P: number
  px: number
  py: number
  snapOff?: boolean
}): Ghost {
  const { gas, tool: t, a, start: A, segmentCount, V, P, px, py, snapOff = false } = opts
  let end: number
  let bPV: { P: number; V: number }
  if (t === 'isochoric') {
    end = snapP(P, snapOff)
    bPV = { V: a.V, P: end }
  } else if (t === 'isobaric') {
    end = snapV(V, snapOff)
    bPV = { V: end, P: a.P }
  } else {
    let bestD = Infinity
    let bestV = a.V
    for (let i = 0; i <= 420; i++) {
      const v = 0.5 + (i * (VMAX - 0.5)) / 420
      const d = Math.hypot(xV(v) - px, yP(curveP(gas, t, a.P, a.V, v)) - py)
      if (d < bestD) {
        bestD = d
        bestV = v
      }
    }
    end = snapV(bestV, snapOff)
    bPV = { V: end, P: curveP(gas, t, a.P, a.V, end) }
  }
  let closing = false
  if (segmentCount >= 2) {
    const onCurve =
      t === 'isochoric'
        ? Math.abs(xV(a.V) - xV(A.V)) < 3
        : Math.abs(yP(curveP(gas, t, a.P, a.V, A.V)) - yP(A.P)) < 10
    if (onCurve && Math.hypot(px - xV(A.V), py - yP(A.P)) < 30) {
      closing = true
      end = t === 'isochoric' ? A.P : A.V
      bPV = { V: A.V, P: A.P }
    }
  }
  const b: GasState = { ...bPV, T: temperature(gas, bPV.P, bPV.V) }
  let valid = isValidState(b)
  let why = ''
  if (!valid)
    why =
      b.T < LIMITS.Tmin
        ? `온도가 ${LIMITS.Tmin} K 아래로 내려가요`
        : b.T > LIMITS.Tmax
          ? `온도가 ${LIMITS.Tmax} K를 넘어요`
          : '그래프 범위를 벗어나요'
  if (valid && Math.abs(b.V - a.V) < 0.25 && Math.abs(b.P - a.P) < 2.5) {
    valid = false
    why = '변화가 너무 작아요'
  }
  return { type: t, end, a, b, valid, closing, why }
}

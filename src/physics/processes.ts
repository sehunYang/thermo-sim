import { R, cv, temperature, type GasConfig, type GasState, type ProcessType } from './gas'

export interface Energy {
  W: number // work done by the gas, J
  Q: number // heat absorbed by the gas, J
  dU: number // J
  dT: number // K
}

/** Pressure on the process curve through (P1, V1) at volume V. Not defined for isochoric. */
export function curveP(
  gas: GasConfig,
  type: Exclude<ProcessType, 'isochoric'>,
  P1: number,
  V1: number,
  V: number,
): number {
  if (type === 'isobaric') return P1
  if (type === 'isothermal') return (P1 * V1) / V
  return P1 * Math.pow(V1 / V, gas.gamma)
}

export function state(gas: GasConfig, P: number, V: number): GasState {
  return { P, V, T: temperature(gas, P, V) }
}

/** End state of a segment from its start state and free variable (P₂ for isochoric, V₂ otherwise). */
export function endState(gas: GasConfig, type: ProcessType, a: GasState, end: number): GasState {
  if (type === 'isochoric') return state(gas, end, a.V)
  return state(gas, curveP(gas, type, a.P, a.V, end), end)
}

/** State at fraction s ∈ [0, 1] of the free variable along a segment from a to b. */
export function stateBetween(
  gas: GasConfig,
  type: ProcessType,
  a: GasState,
  b: GasState,
  s: number,
): GasState {
  if (type === 'isochoric') return state(gas, a.P + (b.P - a.P) * s, a.V)
  const V = a.V + (b.V - a.V) * s
  return state(gas, curveP(gas, type, a.P, a.V, V), V)
}

/** Closed-form energy exchanged between states a and b on a process of the given type. */
export function energy(gas: GasConfig, type: ProcessType, a: GasState, b: GasState): Energy {
  const dT = b.T - a.T
  let dU = gas.n * cv(gas) * dT
  let W: number
  if (type === 'isochoric') W = 0
  else if (type === 'isobaric') W = a.P * (b.V - a.V)
  else if (type === 'isothermal') {
    W = gas.n * R * a.T * Math.log(b.V / a.V)
    dU = 0
  } else W = (a.P * a.V - b.P * b.V) / (gas.gamma - 1)
  const Q = type === 'adiabatic' ? 0 : dU + W
  return { W, Q, dU, dT }
}

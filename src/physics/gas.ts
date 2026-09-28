export type ProcessType = 'isochoric' | 'isobaric' | 'isothermal' | 'adiabatic'

export interface GasConfig {
  n: number
  gamma: number
  label: '단원자' | '이원자'
}

export interface GasState {
  P: number // kPa
  V: number // L
  T: number // K
}

/** J/(mol·K). With P in kPa and V in L, P·V comes out in J. */
export const R = 8.314

export const MONATOMIC: GasConfig = { n: 1, gamma: 5 / 3, label: '단원자' }
export const DIATOMIC: GasConfig = { n: 1, gamma: 7 / 5, label: '이원자' }

export function temperature(gas: GasConfig, P: number, V: number): number {
  return (P * V) / (gas.n * R)
}

/** Molar heat capacity at constant volume, Cv = R / (γ − 1). */
export function cv(gas: GasConfig): number {
  return R / (gas.gamma - 1)
}

export function internalEnergy(gas: GasConfig, T: number): number {
  return gas.n * cv(gas) * T
}

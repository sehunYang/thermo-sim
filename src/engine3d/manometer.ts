import { LIMITS } from '../physics/path'

/** Standard atmosphere, kPa: the open arm of the U-tube always sees this. */
export const P_ATM = 101.325
/** Mercury at 0 °C: ρg in kPa per metre (13 595.1 kg/m³ × 9.806 65 m/s², so 1 mmHg = 133.322 Pa). */
export const RHO_G_HG = 133.322

/** Real level difference in metres of mercury, gas arm below the open arm when positive. */
export const dhMetres = (P: number) => (P - P_ATM) / RHO_G_HG

/** Column height (scene units, above the bend) of both arms when the gas is at P_ATM. */
export const REST = 1.0
/** Drawing scale, scene units per kPa: the full range Pmin…Pmax fits the tube, linearly. */
export const K_DRAW = 1.8 / (LIMITS.Pmax - P_ATM)

/**
 * Open-tube mercury manometer under quasi-static processes. One arm feeds from the gas, the other
 * is open to the constant atmosphere. Mercury is conserved, so the arms move equally and
 * oppositely, and the level difference is proportional to P − P_atm: ρgΔh = P − P_atm.
 * The drawing is linear in that difference but reduced (the real Δh reaches metres).
 */
export function manometerLevels(P: number): { gas: number; open: number } {
  const half = (K_DRAW * (P - P_ATM)) / 2
  return { gas: REST - half, open: REST + half }
}

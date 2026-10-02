import type { ProcessType } from '../physics/gas'
import { LIMITS } from '../physics/path'

/** Mercury at 0 °C: ρg in kPa per metre (13 595.1 kg/m³ × 9.806 65 m/s², so 1 mmHg = 133.322 Pa). */
export const RHO_G_HG = 133.322

/**
 * Pressure pushing on the piston from outside (atmosphere plus weights and any applied force,
 * per area) for an ideal gas in a quasi-static piston process.
 *
 * - Isochoric: the pins hold the piston, the outside is left alone, so P_ext keeps the value it
 *   had when the step began while the gas pressure changes; the pins carry P − P_ext.
 * - Isobaric, isothermal, adiabatic: the piston moves only through equilibrium states, so
 *   P_ext = P at every instant (constant in isobaric, falling or rising with P otherwise).
 *
 * After an isochoric step the weights are changed while the pins still hold, so P_ext meets P
 * before the piston is released; that is the only place P_ext changes abruptly.
 */
export function externalPressure(type: ProcessType, P: number, Pstart: number, live: boolean) {
  return live && type === 'isochoric' ? Pstart : P
}

/** Real level difference in metres of mercury for a pressure difference in kPa. */
export const dhMetres = (dP: number) => dP / RHO_G_HG

/** Column height (scene units, above the bend) of both arms when P = P_ext. */
export const REST = 1.0
/** Drawing scale, scene units per kPa: any difference within Pmin…Pmax fits the tube, linearly. */
export const K_DRAW = 1.8 / (LIMITS.Pmax - LIMITS.Pmin)

/**
 * U-tube mercury manometer between the gas (P) and the outside of the piston (P_ext). It senses
 * only the difference: ρgΔh = P − P_ext, so a pressure shared by both ends moves nothing.
 * Mercury is conserved and the arms have equal bores, so the gas arm falls by Δh/2 exactly as
 * the outside arm rises by Δh/2. The drawing is linear in P − P_ext but reduced (real Δh reaches
 * metres).
 */
export function manometerLevels(dP: number): { gas: number; ext: number } {
  const half = (K_DRAW * dP) / 2
  return { gas: REST - half, ext: REST + half }
}

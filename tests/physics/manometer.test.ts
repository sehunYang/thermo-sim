import { describe, expect, it } from 'vitest'
import { LIMITS, resolve, stateAt } from '../../src/physics/path'
import { MONATOMIC } from '../../src/physics/gas'
import { buildPreset } from '../../src/presets/cycles'
import {
  K_DRAW,
  P_ATM,
  RHO_G_HG,
  REST,
  dhMetres,
  manometerLevels,
} from '../../src/engine3d/manometer'

describe('open-tube manometer', () => {
  it('reads level at atmospheric pressure', () => {
    const m = manometerLevels(P_ATM)
    expect(m.gas).toBeCloseTo(REST, 12)
    expect(m.open).toBeCloseTo(REST, 12)
  })

  it('conserves mercury: arms move equally and oppositely', () => {
    for (const P of [5, 50, 101.325, 200, 350, 500]) {
      const m = manometerLevels(P)
      expect(m.gas + m.open).toBeCloseTo(2 * REST, 12)
    }
  })

  it('draws Δh linearly in P − P_atm, gas arm lower when P > P_atm', () => {
    for (const P of [5, 80, 150, 300, 500]) {
      const m = manometerLevels(P)
      expect(m.open - m.gas).toBeCloseTo(K_DRAW * (P - P_ATM), 12)
      expect(Math.sign(m.open - m.gas)).toBe(Math.sign(P - P_ATM))
    }
  })

  it('uses ρg of mercury: one atmosphere of gauge pressure is 760 mmHg', () => {
    expect(dhMetres(2 * P_ATM)).toBeCloseTo(0.76, 3)
    expect(RHO_G_HG).toBeCloseTo((13595.1 * 9.80665) / 1000, 1)
  })

  it('keeps both columns inside the tube over the whole pressure range', () => {
    for (const P of [LIMITS.Pmin, LIMITS.Pmax]) {
      const m = manometerLevels(P)
      for (const h of [m.gas, m.open]) {
        expect(h).toBeGreaterThanOrEqual(0.08)
        expect(h).toBeLessThanOrEqual(1.9)
      }
    }
  })

  it('stays still through an isobaric step', () => {
    const segs = resolve(buildPreset('brayton'))
    const iso = segs.find((r) => r.segment.type === 'isobaric')!
    const m0 = manometerLevels(iso.a.P)
    for (let s = 0; s <= 1; s += 0.1) {
      const m = manometerLevels(stateAt(MONATOMIC, iso, s).P)
      expect(m.gas).toBeCloseTo(m0.gas, 9)
      expect(m.open).toBeCloseTo(m0.open, 9)
    }
  })
})

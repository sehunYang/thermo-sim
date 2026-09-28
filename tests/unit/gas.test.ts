import { describe, expect, it } from 'vitest'
import { DIATOMIC, MONATOMIC, R, cv, internalEnergy, temperature } from '../../src/physics/gas'

describe('ideal gas', () => {
  it('gives kPa·L = J consistent temperatures', () => {
    // 1 mol at 10 L and 249.42 kPa is 300 K
    expect(temperature(MONATOMIC, (R * 300) / 10, 10)).toBeCloseTo(300, 6)
  })

  it('uses Cv = 3/2 R for monatomic and 5/2 R for diatomic gas', () => {
    expect(cv(MONATOMIC)).toBeCloseTo(1.5 * R, 9)
    expect(cv(DIATOMIC)).toBeCloseTo(2.5 * R, 9)
    expect(internalEnergy(MONATOMIC, 300)).toBeCloseTo(3741.3, 1)
  })
})

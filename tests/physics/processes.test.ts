import { describe, expect, it } from 'vitest'
import { MONATOMIC, R } from '../../src/physics/gas'
import { endState, energy, state } from '../../src/physics/processes'

const gas = MONATOMIC

describe('§3.4 reference values (monatomic, 1 mol)', () => {
  it('isothermal 300 K, 10 L → 20 L', () => {
    const a = state(gas, (R * 300) / 10, 10)
    const b = endState(gas, 'isothermal', a, 20)
    const e = energy(gas, 'isothermal', a, b)
    expect(b.T).toBeCloseTo(300, 9)
    expect(e.W).toBeCloseTo(1728.8, 1)
    expect(e.Q).toBeCloseTo(e.W, 9)
    expect(e.dU).toBe(0)
  })

  it('adiabatic (10 L, 300 kPa) → 20 L', () => {
    const a = state(gas, 300, 10)
    const b = endState(gas, 'adiabatic', a, 20)
    const e = energy(gas, 'adiabatic', a, b)
    expect(b.P).toBeCloseTo(94.49, 2)
    expect(e.W).toBeCloseTo(1665.2, 1)
    expect(e.Q).toBe(0)
    expect(e.dU).toBeCloseTo(-e.W, 9)
  })
})

describe('first law holds for every process', () => {
  const a = state(gas, 200, 15)
  it.each([
    ['isochoric', 320],
    ['isobaric', 27],
    ['isothermal', 27],
    ['adiabatic', 27],
  ] as const)('%s', (type, end) => {
    const b = endState(gas, type, a, end)
    const e = energy(gas, type, a, b)
    expect(e.Q).toBeCloseTo(e.dU + e.W, 9)
  })

  it('isochoric does no work and isobaric uses Cp', () => {
    const iso = energy(gas, 'isochoric', a, endState(gas, 'isochoric', a, 320))
    expect(iso.W).toBe(0)
    const b = endState(gas, 'isobaric', a, 27)
    const bar = energy(gas, 'isobaric', a, b)
    expect(bar.Q).toBeCloseTo(gas.n * 2.5 * R * bar.dT, 9)
  })
})

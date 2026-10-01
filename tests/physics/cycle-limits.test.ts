import { describe, expect, it } from 'vitest'
import { DIATOMIC, MONATOMIC, type ProcessType } from '../../src/physics/gas'
import {
  analyzeCycle,
  isValidPath,
  reservoirLabels,
  reservoirSides,
  reservoirTemps,
  resolve,
  stateAt,
  type ProcessPath,
} from '../../src/physics/path'
import { autoClose } from '../../src/physics/close'
import { buildPreset } from '../../src/presets/cycles'

const rect: ProcessPath = {
  // The teacher's rectangle: A(10 L, 100 kPa) ↑ 300 kPa → 30 L ↓ 100 kPa → back to A.
  gas: MONATOMIC,
  start: { P: 100, V: 10 },
  segments: [
    { id: 'a', type: 'isochoric', end: 300 },
    { id: 'b', type: 'isobaric', end: 30 },
    { id: 'c', type: 'isochoric', end: 100 },
    { id: 'd', type: 'isobaric', end: 10 },
  ],
  closed: true,
}

const ccw: ProcessPath = {
  // The learner's counter-clockwise loop: isothermal out, isochoric up, isobaric back.
  gas: MONATOMIC,
  start: { P: 300, V: 10 },
  segments: [
    { id: 'a', type: 'isothermal', end: 30 },
    { id: 'b', type: 'isochoric', end: 300 },
    { id: 'c', type: 'isobaric', end: 10 },
  ],
  closed: true,
}

/** Every reservoir the gas touches is on the right side of the gas temperature. */
function heatFlowsDownhill(path: ProcessPath) {
  const labels = reservoirLabels(path)!
  const sides = reservoirSides(path)
  resolve(path).forEach((r, i) => {
    const side = sides[i]
    if (!side) return
    const Tres = labels[side]
    for (let k = 0; k <= 20; k++) {
      const { T } = stateAt(path.gas, r, k / 20)
      if (r.energy.Q > 0) expect(Tres).toBeGreaterThanOrEqual(T - 1e-6)
      else expect(Tres).toBeLessThanOrEqual(T + 1e-6)
    }
  })
}

describe('second law in the scene and the cycle analysis', () => {
  it('the rectangle never takes heat from a colder reservoir', () => {
    expect(reservoirSides(rect)).toEqual(['hot', 'hot', 'cold', 'cold'])
    heatFlowsDownhill(rect)
    const c = analyzeCycle(rect)!
    if (c.kind !== 'engine') throw new Error('expected engine')
    expect(c.efficiency).toBeCloseTo(4000 / 18000, 4)
    expect(c.efficiency).toBeLessThan(c.carnotEfficiency)
  })

  it('the counter-clockwise loop is not called a refrigerator', () => {
    const c = analyzeCycle(ccw)!
    expect(c.kind).toBe('dissipative')
    heatFlowsDownhill(ccw)
  })

  it('reverse Brayton stays below its Carnot COP, set by room and outdoor temperatures', () => {
    for (const gas of [MONATOMIC, DIATOMIC]) {
      const path = buildPreset('revbrayton', gas)
      const c = analyzeCycle(path)!
      if (c.kind !== 'refrigerator') throw new Error('expected refrigerator')
      expect(c.cop).toBeLessThan(c.carnotCop)
      expect(c.Tsrc).toBeLessThan(c.Tsink)
      heatFlowsDownhill(path)
    }
  })

  it.each(['carnot', 'otto', 'diesel', 'stirling', 'brayton', 'revcarnot', 'revbrayton'] as const)(
    '%s sends heat downhill',
    (name) => heatFlowsDownhill(buildPreset(name)),
  )

  it('holds η ≤ η_C and COP ≤ COP_C for a thousand random closed cycles', () => {
    // Deterministic pseudo-random walk so a failure can be replayed.
    let seed = 7
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647
    const types: ProcessType[] = ['isochoric', 'isobaric', 'isothermal', 'adiabatic']
    let checked = 0
    for (let tries = 0; checked < 1000 && tries < 50000; tries++) {
      const gas = rnd() < 0.5 ? MONATOMIC : DIATOMIC
      const n = 1 + Math.floor(rnd() * 3)
      const segments = Array.from({ length: n }, (_, i) => {
        const type = types[Math.floor(rnd() * 4)]
        return { id: `r${i}`, type, end: type === 'isochoric' ? 20 + rnd() * 460 : 2 + rnd() * 46 }
      })
      const open: ProcessPath = {
        gas,
        start: { P: 20 + rnd() * 460, V: 2 + rnd() * 46 },
        segments,
        closed: false,
      }
      if (!isValidPath(open)) continue
      const c0 = autoClose(open)
      if (!c0) continue
      const kept =
        c0.adjust != null
          ? segments.map((s, i) => (i === n - 1 ? { ...s, end: c0.adjust! } : s))
          : segments
      const path: ProcessPath = {
        ...open,
        segments: [...kept, ...c0.add.map((s, i) => ({ id: `c${i}`, ...s }))],
        closed: true,
      }
      const c = analyzeCycle(path)!
      const { Tsrc, Tsink } = reservoirTemps(path)
      if (Tsrc == null || Tsink == null) continue
      if (c.kind === 'engine') expect(c.efficiency).toBeLessThanOrEqual(c.carnotEfficiency + 1e-6)
      if (c.kind === 'refrigerator') expect(c.cop).toBeLessThanOrEqual(c.carnotCop + 1e-6)
      heatFlowsDownhill(path)
      checked++
    }
    expect(checked).toBe(1000)
  })
})

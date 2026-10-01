import { describe, expect, it } from 'vitest'
import { DIATOMIC, MONATOMIC, R, cv } from '../../src/physics/gas'
import { resolve, stateAt } from '../../src/physics/path'
import { state } from '../../src/physics/processes'
import { buildPreset } from '../../src/presets/cycles'
import { computeGhost } from '../../src/graph/geometry'
import { entropy, makePlane, px } from '../../src/graph/views'

describe('graph planes', () => {
  for (const gas of [MONATOMIC, DIATOMIC]) {
    const A = { P: 200, V: 10 }

    it(`entropy follows ΔS = Q/T and stays put on adiabats (${gas.label})`, () => {
      expect(entropy(gas, A, A.P, A.V)).toBeCloseTo(0, 12)
      // Isothermal doubling: ΔS = nR ln 2.
      expect(entropy(gas, A, A.P / 2, A.V * 2)).toBeCloseTo(gas.n * R * Math.log(2), 9)
      // Isochoric heating to twice T: ΔS = n·Cv·ln 2.
      expect(entropy(gas, A, A.P * 2, A.V)).toBeCloseTo(gas.n * cv(gas) * Math.log(2), 9)
      // Adiabat: P·V^γ fixed.
      const V = 23
      expect(entropy(gas, A, A.P * Math.pow(A.V / V, gas.gamma), V)).toBeCloseTo(0, 9)
    })

    it(`every closed preset returns to S = 0 and fits the axes (${gas.label})`, () => {
      for (const name of ['carnot', 'otto'] as const) {
        const path = buildPreset(name, gas)
        const segs = resolve(path)
        const states = segs.flatMap((r) => [0, 0.5, 1].map((s) => stateAt(gas, r, s)))
        const end = segs[segs.length - 1].b
        expect(entropy(gas, path.start, end.P, end.V)).toBeCloseTo(0, 6)
        for (const id of ['PT', 'TS'] as const) {
          const pl = makePlane(id, gas, path.start, states)
          for (const s of states) {
            const [x, y] = pl.val(s.P, s.V)
            expect(x).toBeGreaterThanOrEqual(pl.x.min)
            expect(x).toBeLessThanOrEqual(pl.x.max)
            expect(y).toBeGreaterThanOrEqual(pl.y.min)
            expect(y).toBeLessThanOrEqual(pl.y.max)
          }
        }
      }
    })

    it(`maps axis values back to the same state in P-T and T-S (${gas.label})`, () => {
      for (const id of ['PV', 'PT', 'TS'] as const) {
        const pl = makePlane(id, gas, A, [A])
        const s = state(gas, 140, 17)
        const back = pl.at(...pl.val(s.P, s.V))!
        expect(back.P).toBeCloseTo(s.P, 9)
        expect(back.V).toBeCloseTo(s.V, 9)
        expect(back.T).toBeCloseTo(s.T, 9)
      }
    })
  }

  it('draws Carnot as a rectangle in T-S', () => {
    const gas = MONATOMIC
    const path = buildPreset('carnot', gas)
    const pl = makePlane('TS', gas, path.start, [path.start])
    for (const r of resolve(path)) {
      const a = pl.val(r.a.P, r.a.V)
      const m = pl.val(...((s) => [s.P, s.V] as const)(stateAt(gas, r, 0.5)))
      // Isotherms keep T (horizontal), adiabats keep S (vertical).
      if (r.segment.type === 'isothermal') expect(m[1]).toBeCloseTo(a[1], 9)
      else expect(m[0]).toBeCloseTo(a[0], 9)
    }
  })

  it('places a point by the free value of the tool in another plane', () => {
    const gas = MONATOMIC
    const A = { P: 200, V: 10 }
    const a = state(gas, A.P, A.V)
    const base = { gas, a, start: A, segmentCount: 0, V: 0, P: 0 }
    // T-S, adiabatic: the line is vertical, so pointing up only raises T and S stays at 0.
    const ts = makePlane('TS', gas, A, [A])
    const [x0, y0] = px(ts, A.P, A.V)
    const g = computeGhost({ ...base, tool: 'adiabatic', px: x0 + 40, py: y0 - 60, plane: ts })
    expect(g.valid).toBe(true)
    expect(g.b.T).toBeGreaterThan(a.T)
    expect(entropy(gas, A, g.b.P, g.b.V)).toBeCloseTo(0, 1)
    expect(g.end).toBe(Math.round(g.end * 2) / 2)
    // P-T, isochoric: a slanted line through the origin, P/T fixed.
    const pt = makePlane('PT', gas, A, [A])
    const [x1, y1] = px(pt, 300, 10)
    const h = computeGhost({ ...base, tool: 'isochoric', px: x1, py: y1, plane: pt })
    expect(h.b.V).toBe(10)
    expect(h.b.P).toBe(300)
    // P-T, isothermal: vertical; pointing at 100 kPa halves P and doubles V.
    const [x2, y2] = px(pt, 100, 20)
    const k = computeGhost({ ...base, tool: 'isothermal', px: x2, py: y2, plane: pt })
    expect(k.b.V).toBe(20)
    expect(k.b.T).toBeCloseTo(a.T, 9)
  })
})

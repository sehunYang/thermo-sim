import { describe, expect, it } from 'vitest'
import { MONATOMIC } from '../../src/physics/gas'
import { state } from '../../src/physics/processes'
import { Py, Vx, computeGhost, snapP, snapV, xV, yP } from '../../src/graph/geometry'

const gas = MONATOMIC
const ghost = (over: Partial<Parameters<typeof computeGhost>[0]>) => {
  const base = {
    gas,
    tool: 'isothermal' as const,
    a: state(gas, 300, 10),
    start: { P: 300, V: 10 },
    segmentCount: 0,
    V: 20,
    P: 150,
    px: xV(20),
    py: yP(150),
  }
  return computeGhost({ ...base, ...over })
}

describe('graph geometry', () => {
  it('maps V and P to the plot and back', () => {
    expect(Vx(xV(23.5))).toBeCloseTo(23.5, 9)
    expect(Py(yP(321))).toBeCloseTo(321, 9)
  })

  it('snaps to 0.5 L and 5 kPa unless snapping is off', () => {
    expect(snapV(12.3)).toBe(12.5)
    expect(snapP(122)).toBe(120)
    expect(snapV(12.3, true)).toBe(12.3)
  })
})

describe('ghost segment', () => {
  it('keeps the start volume for isochoric and takes the pointer pressure', () => {
    const g = ghost({ tool: 'isochoric', P: 402 })
    expect(g.b.V).toBe(10)
    expect(g.end).toBe(400)
    expect(g.valid).toBe(true)
  })

  it('stays on the isotherm nearest the pointer', () => {
    const g = ghost({ tool: 'isothermal', px: xV(20), py: yP(150) })
    expect(g.end).toBe(20)
    expect(g.b.T).toBeCloseTo(g.a.T, 9)
  })

  it('rejects states below 50 K', () => {
    const g = ghost({ tool: 'isochoric', a: state(gas, 20, 10), P: 5 })
    expect(g.valid).toBe(false)
    expect(g.why).toContain('50 K')
  })

  it('rejects a change too small to see', () => {
    const g = ghost({ tool: 'isobaric', V: 10.1, px: xV(10.1) })
    expect(g.valid).toBe(false)
  })

  it('snaps onto A and closes once two segments exist', () => {
    // From (20 L, 150 kPa) the isotherm passes through A = (10 L, 300 kPa).
    const g = ghost({
      a: state(gas, 150, 20),
      segmentCount: 2,
      px: xV(10.2),
      py: yP(296),
    })
    expect(g.closing).toBe(true)
    expect(g.b).toMatchObject({ V: 10, P: 300 })
  })

  it('does not close with fewer than two segments', () => {
    const g = ghost({ a: state(gas, 150, 20), segmentCount: 1, px: xV(10), py: yP(300) })
    expect(g.closing).toBe(false)
  })
})

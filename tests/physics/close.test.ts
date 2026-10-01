import { describe, expect, it } from 'vitest'
import { DIATOMIC, MONATOMIC } from '../../src/physics/gas'
import { autoClose, closeWith, editEnd, hasOverlap, meetCurve } from '../../src/physics/close'
import { analyzeCycle, isValidPath, resolve, type ProcessPath } from '../../src/physics/path'
import { state } from '../../src/physics/processes'
import { PRESET_NAMES, buildPreset } from '../../src/presets/cycles'

const gas = MONATOMIC

/** The path with a closure applied, as the store would build it. */
function apply(path: ProcessPath, c: NonNullable<ReturnType<typeof autoClose>>): ProcessPath {
  const n = path.segments.length
  const kept = path.segments.map((s, i) =>
    c.adjust != null && i === n - 1 ? { ...s, end: c.adjust } : s,
  )
  return {
    ...path,
    segments: [...kept, ...c.add.map((s, i) => ({ id: `n${i}`, ...s }))],
    closed: true,
  }
}

/** The last added segment, followed from its own start, really lands on A. */
function landsOnA(p: ProcessPath) {
  const segs = resolve({ ...p, closed: false })
  const end = segs[segs.length - 1].b
  expect(end.V).toBeCloseTo(p.start.V, 3)
  expect(end.P).toBeCloseTo(p.start.P, 2)
}

describe('meetCurve', () => {
  it('finds where an isobar from a state meets the isotherm through another', () => {
    const from = state(gas, 200, 10)
    const [V] = meetCurve(gas, 'isobaric', from, 'isothermal', { P: 100, V: 30 })
    expect(V).toBeCloseTo(15, 6)
  })

  it('returns nothing for two curves of the same kind', () => {
    expect(
      meetCurve(gas, 'adiabatic', state(gas, 200, 10), 'adiabatic', { P: 100, V: 30 }),
    ).toEqual([])
  })
})

describe('autoClose', () => {
  // Carnot with the last isothermal stopped 1.5 L short of the adiabat through A.
  const carnot = buildPreset('carnot')
  const exactVD = carnot.segments[2].end
  const open: ProcessPath = {
    ...carnot,
    closed: false,
    segments: carnot.segments
      .slice(0, 3)
      .map((s, i) => (i === 2 ? { ...s, end: exactVD + 1.5 } : s)),
  }

  it('closes an almost-Carnot path with the adiabat, moving D back onto it', () => {
    const c = autoClose(open)
    expect(c).not.toBeNull()
    expect(c!.add.map((s) => s.type)).toEqual(['adiabatic'])
    expect(c!.adjust).toBeCloseTo(exactVD, 3)
    const p = apply(open, c!)
    expect(isValidPath(p)).toBe(true)
    landsOnA(p)
    const cyc = analyzeCycle(p)
    expect(cyc?.kind === 'engine' && cyc.efficiency).toBeCloseTo(0.4, 3)
  })

  it('leaves a state already on a closing curve where it is', () => {
    const exact: ProcessPath = { ...carnot, closed: false, segments: carnot.segments.slice(0, 3) }
    const c = closeWith(exact, 'adiabatic')
    expect(c!.adjust).toBeCloseTo(exactVD, 6)
    expect(c!.cost).toBeLessThan(1e-6)
  })

  it('closes a single segment with two new ones, since its own curve already runs through A', () => {
    const one: ProcessPath = {
      gas,
      start: { V: 10, P: 300 },
      segments: [{ id: 'a', type: 'isobaric', end: 30 }],
      closed: false,
    }
    const c = autoClose(one)
    expect(c).not.toBeNull()
    expect(c!.adjust).toBeNull()
    expect(c!.add).toHaveLength(2)
    const p = apply(one, c!)
    expect(isValidPath(p)).toBe(true)
    landsOnA(p)
  })

  it('every closure it returns is a valid closed path ending on A', () => {
    const tries: ProcessPath[] = [
      {
        gas,
        start: { V: 10, P: 200 },
        segments: [
          { id: 'a', type: 'isochoric', end: 400 },
          { id: 'b', type: 'isobaric', end: 31 },
        ],
        closed: false,
      },
      {
        gas,
        start: { V: 20, P: 100 },
        segments: [
          { id: 'a', type: 'adiabatic', end: 8 },
          { id: 'b', type: 'isochoric', end: 400 },
          { id: 'c', type: 'isothermal', end: 15 },
        ],
        closed: false,
      },
    ]
    for (const path of tries) {
      const c = autoClose(path)
      expect(c).not.toBeNull()
      const p = apply(path, c!)
      expect(isValidPath(p)).toBe(true)
      landsOnA(p)
    }
  })

  it('does not turn a drawn expansion into a compression when new segments can close instead', () => {
    // The teacher's case: adiabat to 29.5 L, then an isotherm out to 45 L.
    const path: ProcessPath = {
      gas,
      start: { V: 10, P: 200 },
      segments: [
        { id: 'a', type: 'adiabatic', end: 29.5 },
        { id: 'b', type: 'isothermal', end: 45 },
      ],
      closed: false,
    }
    const c = autoClose(path)!
    expect(['none', 'small']).toContain(c.change)
    expect(c.overlap).toBe(false)
    landsOnA(apply(path, c))
  })

  it('spots a segment running back along an earlier line', () => {
    const back: ProcessPath = {
      gas,
      start: { V: 10, P: 200 },
      segments: [
        { id: 'a', type: 'isothermal', end: 30 },
        { id: 'b', type: 'isochoric', end: 100 },
        { id: 'c', type: 'isochoric', end: 80 },
      ],
      closed: false,
    }
    expect(hasOverlap(back)).toBe(true)
    expect(hasOverlap(carnot)).toBe(false)
  })

  it('does nothing on a closed path', () => {
    expect(autoClose(carnot)).toBeNull()
  })
})

describe('editEnd', () => {
  /** The cycle really returns to A along its last process, and its energy books balance. */
  function expectClosedCycle(path: ProcessPath) {
    const segs = resolve({ ...path, closed: false })
    const end = segs[segs.length - 1].b
    expect(end.P).toBeCloseTo(path.start.P, 0)
    expect(end.V).toBeCloseTo(path.start.V, 1)
    const r = resolve(path)
    expect(r.reduce((s, x) => s + x.energy.dU, 0)).toBeCloseTo(0, 0)
    const c = analyzeCycle(path)!
    if (c.kind === 'engine') expect(c.efficiency).toBeLessThanOrEqual(c.carnotEfficiency + 1e-9)
    else if (c.kind === 'refrigerator') expect(c.cop).toBeLessThanOrEqual(c.carnotCop + 1e-9)
  }

  it('leaves every preset cycle closed', () => {
    for (const g of [MONATOMIC, DIATOMIC])
      for (const name of PRESET_NAMES) {
        const p = buildPreset(name, g)
        if (p.closed) expectClosedCycle(p)
      }
  })

  it('moving B of a Carnot cycle refits D so the closing adiabat still reaches A', () => {
    const p = buildPreset('carnot', gas)
    const r = editEnd(p, 0, 25)
    if (!('segments' in r)) throw new Error(r.refused)
    const q = { ...p, segments: r.segments }
    expect(q.segments[0].end).toBe(25)
    expectClosedCycle(q)
  })

  it('moving B of a reverse Carnot cycle keeps COP at or under the Carnot limit', () => {
    const p = buildPreset('revcarnot', gas)
    const r = editEnd(p, 0, 18)
    if (!('segments' in r)) throw new Error(r.refused)
    expectClosedCycle({ ...p, segments: r.segments })
  })

  it('refuses moving the point before A off the closing curve', () => {
    const p = buildPreset('carnot', gas)
    expect(editEnd(p, 2, 18)).toEqual({ refused: 'open' })
  })

  it('refuses a segment of zero length and states out of range', () => {
    const p = buildPreset('isothermal', gas)
    expect(editEnd(p, 0, p.start.V)).toEqual({ refused: 'tiny' })
    expect(editEnd(p, 0, 60)).toEqual({ refused: 'range' })
  })

  it('keeps edits that already close, like Otto C', () => {
    const p = buildPreset('otto', gas)
    const r = editEnd(p, 1, 400)
    if (!('segments' in r)) throw new Error(r.refused)
    expect(r.segments).toEqual(p.segments.map((s, i) => (i === 1 ? { ...s, end: 400 } : s)))
  })
})

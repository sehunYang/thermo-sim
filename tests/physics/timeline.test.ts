import { describe, expect, it } from 'vitest'
import { MONATOMIC } from '../../src/physics/gas'
import { analyzeCycle, resolve } from '../../src/physics/path'
import {
  SEGMENT_SECONDS,
  advance,
  heatSoFar,
  easeS,
  instantAt,
  invEase,
  type Playhead,
} from '../../src/physics/timeline'
import { buildPreset } from '../../src/presets/cycles'

const play = (over: Partial<Playhead> = {}): Playhead => ({
  segmentIndex: 0,
  s: 0,
  playing: true,
  speed: 1,
  loop: false,
  ...over,
})

describe('smoothstep timing', () => {
  it('invEase inverts easeS', () => {
    for (let t = 0; t <= 1; t += 0.05) expect(invEase(easeS(t))).toBeCloseTo(t, 6)
  })

  it('advance moves through segments and stops at the end without loop', () => {
    let p = play()
    p = advance(p, SEGMENT_SECONDS / 2, 2)
    expect(p.segmentIndex).toBe(0)
    expect(p.s).toBeCloseTo(0.5, 9)
    p = advance(p, SEGMENT_SECONDS, 2)
    expect(p.segmentIndex).toBe(1)
    expect(p.s).toBeCloseTo(0.5, 9)
    p = advance(p, SEGMENT_SECONDS, 2)
    expect(p).toMatchObject({ segmentIndex: 1, s: 1, playing: false })
  })

  it('advance wraps with loop on', () => {
    const p = advance(play({ loop: true, segmentIndex: 1, s: 0.5 }), SEGMENT_SECONDS, 2)
    expect(p.segmentIndex).toBe(0)
    expect(p.s).toBeCloseTo(0.5, 9)
    expect(p.playing).toBe(true)
  })
})

describe('instantaneous energy', () => {
  const path = buildPreset('isothermal')
  const [r] = resolve(path)

  it('accumulates to the closed-form totals at the end', () => {
    const end = instantAt(MONATOMIC, r, 1)
    expect(end.sofar.W).toBeCloseTo(r.energy.W, 9)
    expect(end.sofar.Q).toBeCloseTo(r.energy.Q, 9)
  })

  it('rates are zero at segment boundaries and integrate to the total', () => {
    expect(instantAt(MONATOMIC, r, 0).dQ).toBeCloseTo(0, 6)
    expect(instantAt(MONATOMIC, r, 1).dQ).toBeCloseTo(0, 6)
    // ∫ dQ/dτ dτ over the segment equals Q
    const N = 2000
    let sum = 0
    for (let i = 0; i < N; i++) sum += instantAt(MONATOMIC, r, easeS((i + 0.5) / N)).dQ / N
    expect(sum).toBeCloseTo(r.energy.Q, 0)
  })
})

describe('heatSoFar', () => {
  const path = buildPreset('carnot')
  const segs = resolve(path)
  const total = (k: 'qin' | 'qout') => heatSoFar(path.gas, segs, segs.length - 1, 1)[k]

  it('is zero at the start of the cycle', () => {
    expect(heatSoFar(path.gas, segs, 0, 0)).toEqual({ qin: 0, qout: 0 })
  })

  it('ends at the cycle analysis totals', () => {
    const c = analyzeCycle(path)!
    expect(c.kind).toBe('engine')
    if (c.kind !== 'engine') return
    expect(total('qin')).toBeCloseTo(c.Qin, 6)
    expect(total('qout')).toBeCloseTo(c.Qout, 6)
  })

  it('never decreases through the cycle', () => {
    let prev = { qin: 0, qout: 0 }
    for (let i = 0; i < segs.length; i++)
      for (let s = 0; s <= 1; s += 0.1) {
        const h = heatSoFar(path.gas, segs, i, s)
        expect(h.qin).toBeGreaterThanOrEqual(prev.qin - 1e-9)
        expect(h.qout).toBeGreaterThanOrEqual(prev.qout - 1e-9)
        prev = h
      }
  })
})

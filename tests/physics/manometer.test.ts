import { describe, expect, it } from 'vitest'
import { MONATOMIC } from '../../src/physics/gas'
import { LIMITS, resolve, stateAt, type ResolvedSegment } from '../../src/physics/path'
import { buildPreset } from '../../src/presets/cycles'
import {
  K_DRAW,
  RHO_G_HG,
  REST,
  dhMetres,
  externalPressure,
  manometerLevels,
} from '../../src/engine3d/manometer'

/** Gas arm and outside arm through a segment, sampled like the playhead does. */
function sweep(r: ResolvedSegment) {
  const out: { P: number; Pext: number; gas: number; ext: number }[] = []
  for (let s = 0; s <= 1.0001; s += 0.05) {
    const P = stateAt(MONATOMIC, r, s).P
    const Pext = externalPressure(r.segment.type, P, r.a.P, true)
    out.push({ P, Pext, ...manometerLevels(P - Pext) })
  }
  return out
}

const ALL = (['carnot', 'otto', 'diesel', 'brayton', 'stirling', 'revbrayton'] as const).flatMap(
  (n) => resolve(buildPreset(n)),
)
const of = (type: string, dir: (r: ResolvedSegment) => boolean) =>
  ALL.filter((r) => r.segment.type === type && dir(r))
const heats = (r: ResolvedSegment) => r.b.T > r.a.T
const expands = (r: ResolvedSegment) => r.b.V > r.a.V

describe('U-tube between the gas and the outside of the piston', () => {
  it('senses only P − P_ext: a pressure shared by both ends moves nothing', () => {
    expect(manometerLevels(0)).toEqual({ gas: REST, ext: REST })
  })

  it('conserves mercury: the arms move equally and oppositely', () => {
    for (const dP of [-495, -120, 0, 37, 300, 495]) {
      const m = manometerLevels(dP)
      expect(m.gas + m.ext).toBeCloseTo(2 * REST, 12)
      expect(m.ext - m.gas).toBeCloseTo(K_DRAW * dP, 12)
    }
  })

  it('uses ρg of mercury: 101.325 kPa is 760 mmHg', () => {
    expect(dhMetres(101.325)).toBeCloseTo(0.76, 3)
    expect(RHO_G_HG).toBeCloseTo((13595.1 * 9.80665) / 1000, 1)
  })

  it('keeps both columns inside the tube for any difference in range', () => {
    const big = LIMITS.Pmax - LIMITS.Pmin
    for (const dP of [-big, big]) {
      const m = manometerLevels(dP)
      for (const h of [m.gas, m.ext]) {
        expect(h).toBeGreaterThanOrEqual(0.08)
        expect(h).toBeLessThanOrEqual(1.9)
      }
    }
  })
})

describe('the confirmed table, process by process (quasi-static ideal gas)', () => {
  it('isochoric heating: P rises, P_ext stays, gas arm down and outside arm up', () => {
    const segs = of('isochoric', heats)
    expect(segs.length).toBeGreaterThan(0)
    for (const r of segs) {
      const s = sweep(r)
      for (let i = 1; i < s.length; i++) {
        expect(s[i].Pext).toBe(r.a.P)
        expect(s[i].P).toBeGreaterThan(s[i - 1].P)
        expect(s[i].gas).toBeLessThan(s[i - 1].gas)
        expect(s[i].ext).toBeGreaterThan(s[i - 1].ext)
      }
    }
  })

  it('isochoric cooling: P falls, P_ext stays, gas arm up and outside arm down', () => {
    const segs = of('isochoric', (r) => !heats(r))
    expect(segs.length).toBeGreaterThan(0)
    for (const r of segs) {
      const s = sweep(r)
      for (let i = 1; i < s.length; i++) {
        expect(s[i].Pext).toBe(r.a.P)
        expect(s[i].gas).toBeGreaterThan(s[i - 1].gas)
        expect(s[i].ext).toBeLessThan(s[i - 1].ext)
      }
    }
  })

  for (const type of ['isobaric', 'isothermal', 'adiabatic'] as const)
    for (const [name, dir] of [
      ['expansion', expands],
      ['compression', (r: ResolvedSegment) => !expands(r)],
    ] as const)
      it(`${type} ${name}: P_ext follows P, both arms stay level (Δh = 0)`, () => {
        const segs = of(type, dir)
        expect(segs.length).toBeGreaterThan(0)
        for (const r of segs)
          for (const p of sweep(r)) {
            expect(p.Pext).toBe(p.P)
            expect(p.gas).toBe(REST)
            expect(p.ext).toBe(REST)
          }
      })

  it('before playback the scene rests with P_ext = P', () => {
    expect(externalPressure('isochoric', 180, 120, false)).toBe(180)
  })
})

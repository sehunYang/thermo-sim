import { describe, expect, it } from 'vitest'
import { MONATOMIC } from '../../src/physics/gas'
import { reservoirSides, resolve } from '../../src/physics/path'
import { currentView, type PlayState } from '../../src/engine3d/view'
import { buildPreset } from '../../src/presets/cycles'

const path = buildPreset('carnot')
const segs = resolve(path)
const base = {
  gas: MONATOMIC,
  segs,
  sides: reservoirSides(path),
  lastState: segs[3].b,
  tool: 'isothermal' as const,
}
const play = (over: Partial<PlayState>): PlayState => ({
  active: true,
  playing: true,
  seg: 0,
  s: 0.5,
  speed: 1,
  loop: true,
  done: false,
  ...over,
})

describe('engine view', () => {
  it('waits at A on the first process without a playhead', () => {
    const v = currentView({ ...base, play: play({ active: false, playing: false }) })
    expect(v).toMatchObject({ live: false, empty: false, type: 'isothermal', heat: 0, dq: 0 })
    expect(v.st).toEqual(segs[0].a)
  })

  it('is empty before anything is drawn', () => {
    const v = currentView({
      ...base,
      segs: [],
      lastState: null,
      play: play({ active: false, playing: false }),
    })
    expect(v.empty).toBe(true)
  })

  it('takes heat from the hot side while the first isotherm expands', () => {
    const v = currentView({ ...base, play: play({ seg: 0 }) })
    expect(v).toMatchObject({ live: true, type: 'isothermal', side: 'hot', vdir: 1 })
    expect(v.dq).toBeGreaterThan(0)
    expect(v.W).toBeCloseTo(v.Q, 6)
  })

  it('releases heat to the cold side while compressing', () => {
    const v = currentView({ ...base, play: play({ seg: 2 }) })
    expect(v).toMatchObject({ side: 'cold', vdir: -1 })
    expect(v.dq).toBeLessThan(0)
  })

  it('keeps the segment heat direction and reservoir while paused', () => {
    const v = currentView({ ...base, play: play({ playing: false }) })
    expect(v).toMatchObject({ dq: 0, moving: false, heat: 1, work: 1, side: 'hot' })
  })

  it('names the coming segment at its very start, not the one before', () => {
    // C→D compresses: at s = 0 nothing has happened yet, but the work already points inwards.
    const v = currentView({ ...base, play: play({ seg: 2, s: 0, playing: false }) })
    expect(v).toMatchObject({ heat: -1, work: -1, side: 'cold', W: 0 })
  })

  it('has no heat on an adiabat even when Q rounds away from zero', () => {
    const v = currentView({ ...base, play: play({ seg: 1 }) })
    expect(v).toMatchObject({ heat: 0, side: null })
  })
})

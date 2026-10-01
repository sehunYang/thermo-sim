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
  it('is idle without a playhead', () => {
    const v = currentView({ ...base, play: play({ active: false, playing: false }) })
    expect(v.live).toBe(false)
    expect(v.dq).toBe(0)
    expect(v.st).toEqual(segs[3].b)
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

  it('has no heat rate while paused', () => {
    const v = currentView({ ...base, play: play({ playing: false }) })
    expect(v.dq).toBe(0)
    expect(v.moving).toBe(false)
  })
})

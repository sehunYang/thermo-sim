import { describe, expect, it } from 'vitest'
import { DIATOMIC } from '../../src/physics/gas'
import { analyzeCycle, isValidPath, reservoirSides, resolve } from '../../src/physics/path'
import { PRESET_NAMES, buildPreset } from '../../src/presets/cycles'

describe('Carnot reference cycle (500 K / 300 K, 10 L → 20 L)', () => {
  const path = buildPreset('carnot')
  const segs = resolve(path)

  it('passes through the §3.4 corner states', () => {
    const corners = segs.map((r) => r.a)
    const expected = [
      [10, 415.7],
      [20, 207.9],
      [43.03, 57.96],
      [21.52, 115.9],
    ]
    corners.forEach((c, i) => {
      expect(c.V).toBeCloseTo(expected[i][0], 1)
      expect(c.P).toBeCloseTo(expected[i][1], 0)
    })
  })

  it('has Q_in = 2881.4 J, W_net = 1152.6 J and η = η_C = 0.400', () => {
    const c = analyzeCycle(path)
    expect(c?.kind).toBe('engine')
    if (c?.kind !== 'engine') return
    expect(c.Qin).toBeCloseTo(2881.4, 0)
    expect(c.Wnet).toBeCloseTo(1152.6, 0)
    expect(c.efficiency).toBeCloseTo(0.4, 3)
    expect(c.carnotEfficiency).toBeCloseTo(0.4, 3)
    expect(c.sumDU).toBeCloseTo(0, 6)
  })

  it('draws heat from the hot side and dumps it on the cold side', () => {
    expect(reservoirSides(path)).toEqual(['hot', null, 'cold', null])
  })
})

describe('presets', () => {
  it.each(PRESET_NAMES)('%s stays inside the graph range and allowed temperatures', (name) => {
    expect(isValidPath(buildPreset(name))).toBe(true)
  })

  it.each(PRESET_NAMES.filter((n) => buildPreset(n).closed))('%s closes with ΣΔU = 0', (name) => {
    const c = analyzeCycle(buildPreset(name))
    expect(c).not.toBeNull()
    expect(c!.sumDU).toBeCloseTo(0, 6)
  })

  it.each(['otto', 'diesel', 'stirling', 'brayton'] as const)(
    '%s is an engine below the Carnot limit',
    (name) => {
      const c = analyzeCycle(buildPreset(name))
      expect(c?.kind).toBe('engine')
      if (c?.kind !== 'engine') return
      expect(c.efficiency).toBeGreaterThan(0)
      expect(c.efficiency).toBeLessThan(c.carnotEfficiency)
    },
  )

  it('reverse Carnot (400 K ↔ 300 K) is a refrigerator with COP 3.00', () => {
    const c = analyzeCycle(buildPreset('revcarnot'))
    expect(c?.kind).toBe('refrigerator')
    if (c?.kind !== 'refrigerator') return
    expect(c.cop).toBeCloseTo(3, 2)
    expect(c.carnotCop).toBeCloseTo(3, 2)
    expect(c.Qh).toBeCloseTo(c.Qc + c.Win, 6)
    expect(reservoirSides(buildPreset('revcarnot'))).toEqual([null, 'cold', null, 'hot'])
  })

  it('reverse Brayton is a refrigerator', () => {
    expect(analyzeCycle(buildPreset('revbrayton'))?.kind).toBe('refrigerator')
  })

  it('Carnot stays at η_C with a diatomic gas', () => {
    const c = analyzeCycle(buildPreset('carnot', DIATOMIC))
    if (c?.kind !== 'engine') throw new Error('expected engine')
    expect(c.efficiency).toBeCloseTo(c.carnotEfficiency, 3)
  })

  it('open paths have no cycle analysis', () => {
    expect(analyzeCycle(buildPreset('isothermal'))).toBeNull()
  })
})

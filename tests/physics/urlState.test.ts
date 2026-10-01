import { describe, expect, it } from 'vitest'
import { analyzeCycle } from '../../src/physics/path'
import { PRESET_NAMES, buildPreset } from '../../src/presets/cycles'
import {
  decode,
  encode,
  readHash,
  shareUrl,
  toPath,
  type SavedPath,
} from '../../src/share/urlState'

const fromPreset = (name: (typeof PRESET_NAMES)[number]): SavedPath => {
  const p = buildPreset(name)
  return {
    gas: 'mono',
    start: p.start,
    segments: p.segments.map(({ type, end }) => ({ type, end })),
    closed: p.closed,
  }
}

describe('share links', () => {
  it.each(PRESET_NAMES)('%s round-trips through the link text', (name) => {
    const saved = fromPreset(name)
    const back = decode(encode(saved))
    expect(back).not.toBeNull()
    expect(back!.segments.map((s) => s.type)).toEqual(saved.segments.map((s) => s.type))
    expect(back!.closed).toBe(saved.closed)
  })

  it('keeps the Carnot efficiency after a round trip', () => {
    const back = decode(encode(fromPreset('carnot')))!
    const c = analyzeCycle(toPath(back))
    if (c?.kind !== 'engine') throw new Error('expected engine')
    expect(c.efficiency).toBeCloseTo(0.4, 3)
  })

  it('builds a URL with the path in the hash and reads it back', () => {
    const url = shareUrl('https://sehunyang.github.io/thermo-sim/', fromPreset('otto'))
    expect(url.startsWith('https://sehunyang.github.io/thermo-sim/#p=')).toBe(true)
    expect(readHash(new URL(url).hash)?.segments).toHaveLength(4)
  })

  it.each(['', 'x;1,2;;o', 'm;abc;;o', 'm;10,300;9:20;o', 'm;10,300;3:20;c', 'm;10,9000;;o'])(
    'rejects %j',
    (text) => {
      expect(decode(text)).toBeNull()
    },
  )
})

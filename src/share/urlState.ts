import type { ProcessType } from '../physics/gas'
import { DIATOMIC, MONATOMIC, temperature } from '../physics/gas'
import { isValidPath, isValidState, type ProcessPath } from '../physics/path'
import { PRESET_NAMES, type PresetName } from '../presets/cycles'

/** What a share link or the autosave holds: the gas and the drawn path, nothing derived. */
export interface SavedPath {
  gas: 'mono' | 'di'
  start: { P: number; V: number }
  segments: { type: ProcessType; end: number }[]
  closed: boolean
  /** The example it came from, so a reload or a shared link keeps its name and gas rebuild. */
  preset?: PresetName
}

const TYPES: ProcessType[] = ['isochoric', 'isobaric', 'isothermal', 'adiabatic']
const round = (x: number) => Math.round(x * 1000) / 1000

/**
 * Compact text form, e.g. "m;10,415.7;3:20,4:43.03,3:21.52,4:10;c".
 * Fields: gas (m|d); start V,P; segments as type-digit:end; "c" if closed; optional preset name.
 */
export function encode(p: SavedPath): string {
  const segs = p.segments.map((s) => `${TYPES.indexOf(s.type) + 1}:${round(s.end)}`).join(',')
  return [
    p.gas === 'di' ? 'd' : 'm',
    `${round(p.start.V)},${round(p.start.P)}`,
    segs,
    p.closed ? 'c' : 'o',
    ...(p.preset ? [p.preset] : []),
  ].join(';')
}

/** Parse a share string; returns null for anything malformed or outside the allowed range. */
export function decode(text: string): SavedPath | null {
  const parts = text.split(';')
  if (parts.length !== 4 && parts.length !== 5) return null
  const [g, startS, segsS, closedS, presetS] = parts
  const preset = PRESET_NAMES.find((n) => n === presetS)
  if (presetS !== undefined && !preset) return null
  if (g !== 'm' && g !== 'd') return null
  const [V, P] = startS.split(',').map(Number)
  if (!Number.isFinite(V) || !Number.isFinite(P)) return null
  const segments: SavedPath['segments'] = []
  if (segsS) {
    for (const item of segsS.split(',')) {
      const [t, e] = item.split(':')
      const type = TYPES[Number(t) - 1]
      const end = Number(e)
      if (!type || !Number.isFinite(end)) return null
      segments.push({ type, end })
    }
  }
  const closed = closedS === 'c'
  if (closed && segments.length < 2) return null
  const saved: SavedPath = {
    gas: g === 'd' ? 'di' : 'mono',
    start: { P, V },
    segments,
    closed,
    ...(preset ? { preset } : {}),
  }
  const path = toPath(saved)
  const ok = isValidState({ P, V, T: temperature(path.gas, P, V) }) && isValidPath(path)
  return ok ? saved : null
}

export function toPath(s: SavedPath): ProcessPath {
  return {
    gas: s.gas === 'di' ? DIATOMIC : MONATOMIC,
    start: s.start,
    segments: s.segments.map((x, i) => ({ ...x, id: `u${i}` })),
    closed: s.closed,
  }
}

export const HASH_KEY = 'p'
export const STORAGE_KEY = 'thermo-sim:path'
export const THEME_KEY = 'thermo-sim:theme'

export function readHash(hash: string): SavedPath | null {
  const params = new URLSearchParams(hash.replace(/^#/, ''))
  const v = params.get(HASH_KEY)
  return v ? decode(v) : null
}

export function shareUrl(base: string, p: SavedPath): string {
  const u = new URL(base)
  u.hash = new URLSearchParams({ [HASH_KEY]: encode(p) }).toString()
  return u.toString()
}

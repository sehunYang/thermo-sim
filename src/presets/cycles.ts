import { MONATOMIC, R, type GasConfig } from '../physics/gas'
import type { ProcessPath, Segment } from '../physics/path'

export type PresetName =
  | 'isochoric'
  | 'isobaric'
  | 'isothermal'
  | 'adiabatic'
  | 'carnot'
  | 'otto'
  | 'diesel'
  | 'stirling'
  | 'brayton'
  | 'revcarnot'
  | 'revbrayton'

export const PRESET_NAMES: PresetName[] = [
  'isochoric',
  'isobaric',
  'isothermal',
  'adiabatic',
  'carnot',
  'otto',
  'diesel',
  'stirling',
  'brayton',
  'revcarnot',
  'revbrayton',
]

type Draft = Omit<Segment, 'id'>

export function buildPreset(name: PresetName, gas: GasConfig = MONATOMIC): ProcessPath {
  const g = gas.gamma
  const PofT = (T: number, V: number) => (gas.n * R * T) / V
  let start: { P: number; V: number }
  let segs: Draft[]
  let closed = true
  switch (name) {
    case 'isochoric':
      start = { V: 20, P: 100 }
      segs = [{ type: 'isochoric', end: 300 }]
      closed = false
      break
    case 'isobaric':
      start = { V: 10, P: 200 }
      segs = [{ type: 'isobaric', end: 30 }]
      closed = false
      break
    case 'isothermal':
      start = { V: 10, P: 300 }
      segs = [{ type: 'isothermal', end: 20 }]
      closed = false
      break
    case 'adiabatic':
      start = { V: 10, P: 300 }
      segs = [{ type: 'adiabatic', end: 20 }]
      closed = false
      break
    case 'carnot': {
      const Th = 500
      const VA = 10
      const VB = 20
      let k = Math.pow(Th / 300, 1 / (g - 1))
      if (VB * k > 45) k = 45 / VB
      start = { V: VA, P: PofT(Th, VA) }
      segs = [
        { type: 'isothermal', end: VB },
        { type: 'adiabatic', end: VB * k },
        { type: 'isothermal', end: VA * k },
        { type: 'adiabatic', end: VA },
      ]
      break
    }
    case 'otto': {
      start = { V: 45, P: 50 }
      const PB = 50 * Math.pow(3, g)
      const PC = Math.min(480, PB * 2)
      segs = [
        { type: 'adiabatic', end: 15 },
        { type: 'isochoric', end: PC },
        { type: 'adiabatic', end: 45 },
        { type: 'isochoric', end: 50 },
      ]
      break
    }
    case 'diesel':
      start = { V: 45, P: 50 }
      segs = [
        { type: 'adiabatic', end: 15 },
        { type: 'isobaric', end: 25 },
        { type: 'adiabatic', end: 45 },
        { type: 'isochoric', end: 50 },
      ]
      break
    case 'stirling': {
      const Th = 500
      const Tc = 300
      start = { V: 15, P: PofT(Th, 15) }
      segs = [
        { type: 'isothermal', end: 40 },
        { type: 'isochoric', end: PofT(Tc, 40) },
        { type: 'isothermal', end: 15 },
        { type: 'isochoric', end: start.P },
      ]
      break
    }
    case 'brayton':
      start = { V: 40, P: 60 }
      segs = [
        { type: 'adiabatic', end: 15 },
        { type: 'isobaric', end: 18 },
        { type: 'adiabatic', end: 48 },
        { type: 'isobaric', end: 40 },
      ]
      break
    case 'revcarnot': {
      const VA = 10
      const k = Math.pow(400 / 300, 1 / (g - 1))
      const V2 = VA * k
      const V3 = Math.min(45, V2 * 2)
      start = { V: VA, P: PofT(400, VA) }
      segs = [
        { type: 'adiabatic', end: V2 },
        { type: 'isothermal', end: V3 },
        { type: 'adiabatic', end: V3 / k },
        { type: 'isothermal', end: VA },
      ]
      break
    }
    case 'revbrayton':
      start = { V: 20, P: 80 }
      segs = [
        { type: 'isobaric', end: 30 },
        { type: 'adiabatic', end: 15 },
        { type: 'isobaric', end: 10 },
        { type: 'adiabatic', end: 20 },
      ]
      break
  }
  return {
    gas,
    start,
    segments: segs.map((s, i) => ({ ...s, id: `${name}-${i}` })),
    closed,
  }
}

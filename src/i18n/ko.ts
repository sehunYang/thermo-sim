import type { ProcessType } from '../physics/gas'
import type { PresetName } from '../presets/cycles'

export interface ProcessMeta {
  name: string
  full: string
  key: string
  /** SVG stroke-dasharray, so the four processes differ in shape as well as color */
  dash: string
  cssVar: string
  law: string
}

export const PROC: Record<ProcessType, ProcessMeta> = {
  isochoric: {
    name: '등적',
    full: '등적 과정',
    key: '1',
    dash: '',
    cssVar: '--p-isochoric',
    law: 'V 일정 · W = 0',
  },
  isobaric: {
    name: '등압',
    full: '등압 과정',
    key: '2',
    dash: '10 6',
    cssVar: '--p-isobaric',
    law: 'P 일정 · W = PΔV',
  },
  isothermal: {
    name: '등온',
    full: '등온 과정',
    key: '3',
    dash: '2 5',
    cssVar: '--p-isothermal',
    law: 'T 일정 · ΔU = 0',
  },
  adiabatic: {
    name: '단열',
    full: '단열 과정',
    key: '4',
    dash: '13 5 2 5',
    cssVar: '--p-adiabatic',
    law: 'Q = 0 · PV^γ 일정',
  },
}

export const PROCESS_TYPES = Object.keys(PROC) as ProcessType[]

export const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

export const PRESET_GROUPS: { label: string; items: [PresetName, string][] }[] = [
  {
    label: '단일 과정',
    items: [
      ['isochoric', '등적 가열'],
      ['isobaric', '등압 팽창'],
      ['isothermal', '등온 팽창'],
      ['adiabatic', '단열 팽창'],
    ],
  },
  {
    label: '열기관 순환',
    items: [
      ['carnot', '카르노 순환'],
      ['otto', '오토 순환 (가솔린)'],
      ['diesel', '디젤 순환'],
      ['stirling', '스털링 순환'],
      ['brayton', '브레이턴 순환 (가스터빈)'],
    ],
  },
  {
    label: '냉방기 순환',
    items: [
      ['revcarnot', '역카르노 냉방기'],
      ['revbrayton', '공기 냉방 순환 (역브레이턴)'],
    ],
  },
]

export const PRESET_NOTE: Record<PresetName, string> = {
  isochoric: '부피가 그대로라 일은 0, 흡수한 열은 모두 내부 에너지가 됩니다.',
  isobaric: '같은 압력에서 팽창하면서 열의 일부는 일, 나머지는 내부 에너지가 됩니다.',
  isothermal: '온도가 그대로라 ΔU = 0, 흡수한 열이 모두 일이 됩니다.',
  adiabatic: '열 출입 없이 팽창하므로 내부 에너지를 써서 일을 하고 온도가 내려갑니다.',
  carnot: '두 등온 + 두 단열. 같은 두 온도 사이에서 가능한 가장 높은 효율의 이상 열기관입니다.',
  otto: '가솔린 엔진의 이상화. 단열 압축 → 등적 연소 → 단열 팽창 → 등적 배기.',
  diesel: '디젤 엔진의 이상화. 연소가 등압으로 일어난다는 점이 오토 순환과 다릅니다.',
  stirling: '두 등온 + 두 등적. 외연기관의 이상화입니다.',
  brayton: '가스터빈·제트엔진의 이상화. 두 단열 + 두 등압.',
  revcarnot:
    '카르노 순환을 거꾸로(반시계 방향) 돌린 냉방기. 일을 받아 저온부(실내)의 열을 고온부(실외)로 옮깁니다.',
  revbrayton:
    '공기를 냉매로 쓰는 공기 냉방 순환(항공기 냉방 방식). 등압 흡열 → 단열 압축 → 등압 방열 → 단열 팽창.',
}

export const f1 = (v: number) => v.toFixed(1)
export const f0 = (v: number) => Math.round(v).toString()

/** Energy in J: one decimal below 1000, none above, a real minus sign, and 0 for |v| < 0.05. */
export function fmtE(v: number): string {
  const a = Math.abs(v)
  if (a < 0.05) return '0'
  return (v < 0 ? '−' : '') + (a >= 1000 ? a.toFixed(0) : a.toFixed(1))
}

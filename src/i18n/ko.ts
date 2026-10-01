import type { ProcessType } from '../physics/gas'
import type { PresetName } from '../presets/cycles'

export interface ProcessMeta {
  name: string
  full: string
  /** What stays fixed (or what cannot pass), in everyday words */
  plain: string
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
    plain: '부피 그대로',
    key: '1',
    dash: '',
    cssVar: '--p-isochoric',
    law: 'V 일정 · W = 0',
  },
  isobaric: {
    name: '등압',
    full: '등압 과정',
    plain: '압력 그대로',
    key: '2',
    dash: '10 6',
    cssVar: '--p-isobaric',
    law: 'P 일정 · W = PΔV',
  },
  isothermal: {
    name: '등온',
    full: '등온 과정',
    plain: '온도 그대로',
    key: '3',
    dash: '2 5',
    cssVar: '--p-isothermal',
    law: 'T 일정 · ΔU = 0',
  },
  adiabatic: {
    name: '단열',
    full: '단열 과정',
    plain: '열이 못 드나듦',
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
    '공기를 냉매로 쓰는 공기 냉방 순환(항공기 냉방 방식). 등압 흡열 → 단열 압축 → 등압 방열 → 단열 팽창. 이상화한 예시라 온도가 실제 냉방기보다 극단적이에요.',
}

export const f1 = (v: number) => v.toFixed(1)
export const f0 = (v: number) => Math.round(v).toString()

/** Energy in J: one decimal below 1000, none above, a real minus sign, and 0 for |v| < 0.05. */
export function fmtE(v: number): string {
  const a = Math.abs(v)
  if (a < 0.05) return '0'
  return (v < 0 ? '−' : '') + (a >= 1000 ? a.toFixed(0) : a.toFixed(1))
}

/** "왜 이렇게 움직일까?" steps per process; [expanding, compressing] or one list for isochoric. */
export const WHY: Record<ProcessType, { expand: string[]; compress: string[] } | string[]> = {
  adiabatic: {
    expand: [
      '바깥 압력을 조금씩 낮추면 기체 압력이 더 커져요. U자관에서 바깥 쪽 수은이 올라가 기체 쪽보다 높아져요.',
      '압력이 더 큰 기체가 피스톤을 밀어 올려요. 멀어지는 피스톤에 부딪힌 입자는 느려져요(파랗게 빛남).',
      '단열재 때문에 열이 채워지지 않아 온도가 내려가요. ΔU = −W < 0',
    ],
    compress: [
      '바깥 압력을 조금씩 높이면 바깥 압력이 더 커져요. U자관에서 바깥 쪽 수은이 내려가 기체 쪽보다 낮아져요.',
      '압력이 더 큰 바깥이 피스톤을 밀어 내려요. 다가오는 피스톤에 부딪힌 입자는 빨라져요(빨갛게 빛남).',
      '단열재 때문에 열이 빠져나가지 못해 온도가 올라가요. ΔU = −W > 0',
    ],
  },
  isothermal: {
    expand: [
      '바깥 압력을 조금씩 낮추면 U자관 바깥 쪽 수은이 기체 쪽보다 높아져요. 기체 압력이 더 크다는 뜻이에요.',
      '압력이 더 큰 기체가 피스톤을 밀어 올리고, 부딪힌 입자는 느려지려 해요(파랗게 빛남).',
      '느려지는 만큼 열원에서 열이 들어와 온도가 그대로예요. Q = W',
    ],
    compress: [
      '바깥 압력을 조금씩 높이면 U자관 바깥 쪽 수은이 기체 쪽보다 낮아져요. 바깥 압력이 더 크다는 뜻이에요.',
      '압력이 더 큰 바깥이 피스톤을 밀어 내리고, 부딪힌 입자는 빨라지려 해요(빨갛게 빛남).',
      '빨라지는 만큼 열이 열원으로 빠져나가 온도가 그대로예요. Q = W < 0',
    ],
  },
  isobaric: {
    expand: [
      '기체 압력은 일정해서 U자관 기체 쪽 수은 높이도 그대로예요.',
      '열을 받는 동안 바깥 압력이 기체보다 살짝 작아져(과장해서 표시) 바깥 쪽 수은이 올라가고, 피스톤이 밀려 올라가요.',
      '들어온 열의 일부는 일(W), 나머지는 온도 상승(ΔU)이 돼요.',
    ],
    compress: [
      '기체 압력은 일정해서 U자관 기체 쪽 수은 높이도 그대로예요.',
      '열을 잃는 동안 바깥 압력이 기체보다 살짝 커져(과장해서 표시) 바깥 쪽 수은이 내려가고, 피스톤이 내려가요.',
      '나간 열은 받은 일과 온도 하강을 합한 만큼이에요.',
    ],
  },
  isochoric: [
    '핀이 피스톤을 붙잡아 부피가 변하지 않아요. 바깥 압력은 처음 그대로이고, 끝에서 기체 압력에 맞춘 뒤 핀을 풀어요.',
    '기체 압력만 바뀌어 U자관 기체 쪽 수은만 움직이고 높이 차가 점점 커져요. 그 차이를 핀이 버텨요.',
    '피스톤이 움직이지 않아 일은 0, 열이 모두 온도 변화가 돼요. Q = ΔU',
  ],
}

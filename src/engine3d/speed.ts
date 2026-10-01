import { Color } from 'three'

/** Particle speed (scene units) that maps to the red end of the colour ramp. */
export const SPEED_MAX = 4.2
export const speedU = (sp: number) => sp / SPEED_MAX

const STOPS: [number, number][] = [
  [0, 0x3b82f6],
  [0.35, 0x8b5cf6],
  [0.7, 0xf59e0b],
  [1, 0xef4444],
]

/** Slow blue → violet → amber → fast red, written into c (sRGB components). */
export function speedColor(u: number, c: Color): Color {
  u = Math.max(0, Math.min(1, u))
  let k = 0
  while (k < STOPS.length - 2 && u > STOPS[k + 1][0]) k++
  const [u0, c0] = STOPS[k]
  const [u1, c1] = STOPS[k + 1]
  const t = (u - u0) / (u1 - u0)
  const ch = (shift: number) => (((c0 >> shift) & 255) * (1 - t) + ((c1 >> shift) & 255) * t) / 255
  return c.setRGB(ch(16), ch(8), ch(0), 'srgb')
}

/** rms speed of the model particles at temperature T. */
export const vrmsAt = (T: number) => 1.1 * Math.sqrt(T / 300)

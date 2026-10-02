import type { GasConfig, GasState, ProcessType } from '../physics/gas'
import { stateAt, type ReservoirSide, type ResolvedSegment } from '../physics/path'
import { energy, state } from '../physics/processes'

export interface PlayState {
  /** A playhead exists (the graph and 3D follow it instead of the drawing state). */
  active: boolean
  playing: boolean
  seg: number
  s: number
  speed: number
  loop: boolean
  done: boolean
}

/** Everything the 3D scene and its HUD read for one frame. */
export interface View {
  st: GasState
  type: ProcessType
  /** Heat and work rates, normalised by the largest |Q| and |W| on the path (0 while paused). */
  dq: number
  dw: number
  /**
   * Sign of the whole segment's Q and W. Labels, bridges and arrows follow these, so a paused,
   * scrubbed or just-started segment still says which way heat and work go.
   */
  heat: -1 | 0 | 1
  work: -1 | 0 | 1
  W: number
  Q: number
  /** Following a playhead (as opposed to showing the drawing state). */
  live: boolean
  /** Nothing drawn yet: there is no gas state to show. */
  empty: boolean
  side: ReservoirSide | null
  moving: boolean
  /** +1 expanding, −1 compressing, 0 isochoric or idle */
  vdir: number
}

/** Below this |Q| or |W| a segment counts as exchanging none (rounding of a closing segment). */
const EPS = 0.5
const sgn = (x: number): -1 | 0 | 1 => (x > EPS ? 1 : x < -EPS ? -1 : 0)

export function currentView(opts: {
  gas: GasConfig
  segs: ResolvedSegment[]
  sides: (ReservoirSide | null)[]
  play: PlayState
  lastState: GasState | null
  tool: ProcessType
}): View {
  const { gas, segs, sides, play, lastState, tool } = opts
  if (play.active && segs.length) {
    const i = Math.min(play.seg, segs.length - 1)
    const r = segs[i]
    const t = r.segment.type
    const st = stateAt(gas, r, play.s)
    const e = energy(gas, t, r.a, st)
    const s0 = Math.max(0, play.s - 0.01)
    const s1 = Math.min(1, play.s + 0.01)
    const e0 = energy(gas, t, r.a, stateAt(gas, r, s0))
    const e1 = energy(gas, t, r.a, stateAt(gas, r, s1))
    let maxQ = 1
    let maxW = 1
    for (const x of segs) {
      maxQ = Math.max(maxQ, Math.abs(x.energy.Q))
      maxW = Math.max(maxW, Math.abs(x.energy.W))
    }
    const moving = play.playing
    const ds = s1 - s0 || 1
    const heat = t === 'adiabatic' ? 0 : sgn(r.energy.Q)
    return {
      st,
      type: t,
      dq: moving ? (e1.Q - e0.Q) / ds / maxQ : 0,
      dw: moving ? (e1.W - e0.W) / ds / maxW : 0,
      heat,
      work: t === 'isochoric' ? 0 : sgn(r.energy.W),
      W: e.W,
      Q: e.Q,
      live: true,
      empty: false,
      side: heat ? (sides[i] ?? null) : null,
      moving,
      vdir: t === 'isochoric' ? 0 : Math.sign(r.b.V - r.a.V),
    }
  }
  // Before playback the scene waits at A, on the first segment's process.
  const first = segs[0]
  const st = first?.a ?? lastState ?? state(gas, 150, 20)
  return {
    st,
    type: first?.segment.type ?? tool,
    dq: 0,
    dw: 0,
    heat: 0,
    work: 0,
    W: 0,
    Q: 0,
    live: false,
    empty: !lastState,
    side: null,
    moving: false,
    vdir: first && first.segment.type !== 'isochoric' ? Math.sign(first.b.V - first.a.V) : 0,
  }
}

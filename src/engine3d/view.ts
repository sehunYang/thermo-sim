import type { GasConfig, GasState, ProcessType } from '../physics/gas'
import { stateAt, type ReservoirSide, type ResolvedSegment } from '../physics/path'
import { energy, state } from '../physics/processes'
import { invEase } from '../physics/timeline'

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
  /** Heat and work rates, normalised by the largest |Q| and |W| on the path. */
  dq: number
  dw: number
  W: number
  Q: number
  /** Following a playhead (as opposed to showing the drawing state). */
  live: boolean
  side: ReservoirSide | null
  moving: boolean
  /** +1 expanding, −1 compressing, 0 isochoric or idle */
  vdir: number
  Pstart: number
  Pend: number
  /** Elapsed fraction of the segment's time (s = easeS(tau)). */
  tau: number
}

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
    const r = segs[Math.min(play.seg, segs.length - 1)]
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
    return {
      st,
      type: t,
      dq: moving ? (e1.Q - e0.Q) / ds / maxQ : 0,
      dw: (e1.W - e0.W) / ds / maxW,
      W: e.W,
      Q: e.Q,
      live: true,
      side: sides[play.seg] ?? null,
      moving,
      vdir: t === 'isochoric' ? 0 : Math.sign(r.b.V - r.a.V),
      Pstart: r.a.P,
      Pend: r.b.P,
      tau: invEase(play.s),
    }
  }
  const st = lastState ?? state(gas, 150, 20)
  const type = play.active && segs.length ? segs[segs.length - 1].segment.type : tool
  return {
    st,
    type,
    dq: 0,
    dw: 0,
    W: 0,
    Q: 0,
    live: false,
    side: null,
    moving: false,
    vdir: 0,
    Pstart: st.P,
    Pend: st.P,
    tau: 0,
  }
}

import { autoClose, type Closure } from '../physics/close'
import {
  DIATOMIC,
  MONATOMIC,
  type GasConfig,
  type GasState,
  type ProcessType,
} from '../physics/gas'
import {
  analyzeCycle,
  isValidState,
  reservoirSides,
  resolve,
  temperatureRange,
  type ProcessPath,
  type Segment,
} from '../physics/path'
import { SEGMENT_SECONDS, easeS, invEase } from '../physics/timeline'
import { currentView, type PlayState } from '../engine3d/view'
import { state } from '../physics/processes'
import { buildPreset, type PresetName } from '../presets/cycles'
import type { SavedPath } from '../share/urlState'

interface Snapshot {
  start: { P: number; V: number } | null
  segments: Segment[]
  closed: boolean
}

export type PanelTab = 'table' | 'law' | 'cycle'

const HISTORY_LIMIT = 80
let nextId = 0
const newId = () => `s${++nextId}`

/** The single source of truth for the drawn path. The graph, 3D view and panel only read it. */
export class Simulation {
  gas = $state<GasConfig>(MONATOMIC)
  start = $state<{ P: number; V: number } | null>(null)
  segments = $state<Segment[]>([])
  closed = $state(false)
  preset = $state<PresetName | ''>('')
  tool = $state<ProcessType>('isothermal')
  guides = $state(true)
  tab = $state<PanelTab>('table')
  toast = $state<{ msg: string; id: number } | null>(null)
  /** First-visit guide: 0 hidden, otherwise the 1-based step. */
  coach = $state(0)

  #hist = $state<Snapshot[]>([])
  #fut = $state<Snapshot[]>([])

  path: ProcessPath | null = $derived(
    this.start
      ? { gas: this.gas, start: this.start, segments: this.segments, closed: this.closed }
      : null,
  )
  resolved = $derived(this.path ? resolve(this.path) : [])
  lastState: GasState | null = $derived(
    this.resolved.length
      ? this.resolved[this.resolved.length - 1].b
      : this.start
        ? state(this.gas, this.start.P, this.start.V)
        : null,
  )
  cycle = $derived(this.path ? analyzeCycle(this.path) : null)
  sides = $derived(this.path ? reservoirSides(this.path) : [])
  trange = $derived(this.path ? temperatureRange(this.path) : null)
  fridge = $derived(this.cycle?.kind === 'refrigerator')

  play = $state<PlayState>({
    active: false,
    playing: false,
    seg: 0,
    s: 0,
    speed: 1,
    loop: true,
    done: false,
  })
  view = $derived(
    currentView({
      gas: this.gas,
      segs: this.resolved,
      sides: this.sides,
      play: this.play,
      lastState: this.lastState,
      tool: this.tool,
    }),
  )

  /** Whole-path progress 0..1 (each segment takes an equal share). */
  get progress() {
    const n = this.resolved.length
    return n ? (this.play.seg + this.play.s) / n : 0
  }
  get totalSeconds() {
    return (this.resolved.length * SEGMENT_SECONDS) / this.play.speed
  }

  stopPlay() {
    Object.assign(this.play, { active: false, playing: false, seg: 0, s: 0, done: false })
  }

  togglePlay() {
    const P = this.play
    if (!this.resolved.length) return
    if (P.playing) P.playing = false
    else {
      if (!P.active || P.done) Object.assign(P, { seg: 0, s: 0, done: false })
      P.active = true
      P.playing = true
    }
  }

  rewind() {
    Object.assign(this.play, {
      seg: 0,
      s: 0,
      done: false,
      active: this.resolved.length > 0,
      playing: false,
    })
  }

  nextSegment() {
    const n = this.resolved.length
    if (!n) return
    const P = this.play
    P.active = true
    P.playing = false
    if (P.seg < n - 1) {
      P.seg++
      P.s = 0
      P.done = false
    } else {
      P.s = 1
      P.done = true
    }
  }

  /** Jump to a whole-path progress f (scrubbing); pauses playback. */
  seek(f: number) {
    const n = this.resolved.length
    if (!n) return
    const x = Math.max(0, Math.min(1, f)) * n
    const seg = Math.min(n - 1, Math.floor(x))
    Object.assign(this.play, { seg, s: x - seg, active: true, done: false, playing: false })
  }

  /** Step the paused playhead by a small slice of time (keyboard ← / →). */
  step(dir: 1 | -1) {
    const n = this.resolved.length
    if (!n) return
    const f = this.play.active ? this.progress : 0
    this.seek(f + (dir * 0.01) / n)
  }

  /** Advance playback by dt seconds of wall time (smoothstep timing within each segment). */
  tick(dt: number) {
    const P = this.play
    const n = this.resolved.length
    if (!P.playing || !n) return
    let tau = invEase(P.s) + (dt * P.speed) / SEGMENT_SECONDS
    let seg = P.seg
    while (tau >= 1) {
      if (seg < n - 1) {
        tau -= 1
        seg++
      } else if (this.closed && P.loop) {
        tau -= 1
        seg = 0
      } else {
        tau = 1
        P.playing = false
        P.done = true
        break
      }
    }
    P.seg = seg
    P.s = easeS(tau)
  }

  get canUndo() {
    return this.#hist.length > 0
  }
  get canRedo() {
    return this.#fut.length > 0
  }

  notify(msg: string) {
    this.toast = { msg, id: (this.toast?.id ?? 0) + 1 }
  }

  #snap(): Snapshot {
    return {
      start: this.start ? { ...this.start } : null,
      segments: this.segments.map((s) => ({ ...s })),
      closed: this.closed,
    }
  }
  #restore(s: Snapshot) {
    this.start = s.start
    this.segments = s.segments
    this.closed = s.closed
  }
  #push() {
    this.stopPlay()
    this.#hist = [...this.#hist.slice(-(HISTORY_LIMIT - 1)), this.#snap()]
    this.#fut = []
  }

  undo() {
    const prev = this.#hist.at(-1)
    if (!prev) return
    this.stopPlay()
    this.#fut = [...this.#fut, this.#snap()]
    this.#hist = this.#hist.slice(0, -1)
    this.#restore(prev)
    this.preset = ''
  }
  redo() {
    const next = this.#fut.at(-1)
    if (!next) return
    this.stopPlay()
    this.#hist = [...this.#hist, this.#snap()]
    this.#fut = this.#fut.slice(0, -1)
    this.#restore(next)
  }

  /** Returns false (and changes nothing) when the state is outside the allowed range. */
  setStart(P: number, V: number): boolean {
    if (!isValidState(state(this.gas, P, V))) return false
    this.#push()
    this.start = { P, V }
    this.segments = []
    this.closed = false
    this.preset = ''
    return true
  }

  /** adjust moves the last drawn segment's free value first (snapping a closing segment onto A). */
  addSegment(type: ProcessType, end: number, closes: boolean, adjust: number | null = null) {
    if (!this.start || this.closed) return
    this.#push()
    const n = this.segments.length
    const kept =
      adjust != null && n
        ? this.segments.map((s, i) => (i === n - 1 ? { ...s, end: adjust } : s))
        : this.segments
    this.segments = [...kept, { id: newId(), type, end }]
    if (closes) this.closed = true
    this.preset = ''
  }

  /** Close the path back onto A the shortest way (see autoClose); returns what it did, or null. */
  autoComplete(): Closure | null {
    if (!this.path || this.closed) return null
    const c = autoClose(this.path)
    if (!c) return null
    this.#push()
    const n = this.segments.length
    const kept =
      c.adjust != null
        ? this.segments.map((s, i) => (i === n - 1 ? { ...s, end: c.adjust! } : s))
        : this.segments
    this.segments = [...kept, ...c.add.map((s) => ({ id: newId(), ...s }))]
    this.closed = true
    this.preset = ''
    this.play.loop = true
    return c
  }

  /**
   * Edit one segment's free variable. Later segments keep their type and free variable and are
   * recomputed; the edit is refused if any end state would leave the allowed range.
   */
  setEnd(index: number, end: number): boolean {
    if (!this.start || !Number.isFinite(end)) return false
    const segments = this.segments.map((s, i) => (i === index ? { ...s, end } : s))
    const trial = resolve({ gas: this.gas, start: this.start, segments, closed: this.closed })
    if (trial.some((r) => !isValidState(r.b))) return false
    this.#push()
    this.segments = segments
    this.preset = ''
    return true
  }

  clear() {
    if (!this.start) return
    this.#push()
    this.start = null
    this.segments = []
    this.closed = false
    this.preset = ''
  }

  loadPreset(name: PresetName) {
    this.#push()
    const p = buildPreset(name, this.gas)
    this.start = p.start
    this.segments = p.segments
    this.closed = p.closed
    this.preset = name
    this.play.loop = p.closed
  }

  /** The drawn path in its saved form (for share links and autosave), or null when empty. */
  get saved(): SavedPath | null {
    if (!this.start) return null
    return {
      gas: this.gas.gamma < 1.5 ? 'di' : 'mono',
      start: { ...this.start },
      segments: this.segments.map(({ type, end }) => ({ type, end })),
      closed: this.closed,
    }
  }

  /** Replace the path with a saved one; record = false skips undo history (start-up restore). */
  load(saved: SavedPath, record = true) {
    if (record) this.#push()
    else this.stopPlay()
    this.gas = saved.gas === 'di' ? DIATOMIC : MONATOMIC
    this.start = { ...saved.start }
    this.segments = saved.segments.map((s) => ({ ...s, id: newId() }))
    this.closed = saved.closed
    this.preset = ''
    this.play.loop = saved.closed
  }

  setGas(kind: 'mono' | 'di') {
    this.stopPlay()
    this.gas = kind === 'di' ? DIATOMIC : MONATOMIC
    // A preset is defined by its temperatures, so rebuild it for the new γ.
    if (this.preset) {
      const p = buildPreset(this.preset, this.gas)
      this.start = p.start
      this.segments = p.segments
      this.closed = p.closed
    }
  }
}

export const sim = new Simulation()

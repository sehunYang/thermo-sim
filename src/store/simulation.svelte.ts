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
  resolve,
  type ProcessPath,
  type Segment,
} from '../physics/path'
import { state } from '../physics/processes'
import { buildPreset, type PresetName } from '../presets/cycles'

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
    this.#hist = [...this.#hist.slice(-(HISTORY_LIMIT - 1)), this.#snap()]
    this.#fut = []
  }

  undo() {
    const prev = this.#hist.at(-1)
    if (!prev) return
    this.#fut = [...this.#fut, this.#snap()]
    this.#hist = this.#hist.slice(0, -1)
    this.#restore(prev)
    this.preset = ''
  }
  redo() {
    const next = this.#fut.at(-1)
    if (!next) return
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

  addSegment(type: ProcessType, end: number, closes: boolean) {
    if (!this.start || this.closed) return
    this.#push()
    this.segments = [...this.segments, { id: newId(), type, end }]
    if (closes) this.closed = true
    this.preset = ''
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
  }

  setGas(kind: 'mono' | 'di') {
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

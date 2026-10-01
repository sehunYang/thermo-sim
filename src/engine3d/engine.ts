import * as THREE from 'three'
import { LIMITS } from '../physics/path'
import { easeS } from '../physics/timeline'
import { speedColor, speedU, vrmsAt } from './speed'
import type { View } from './view'

const NP = 300
const CYL_R = 1
const HMIN = 0.1
const HSPAN = 2.9
const RES_X = 2.3
const PMAX = LIMITS.Pmax
const hOfV = (V: number) => HMIN + (V / LIMITS.Vmax) * HSPAN
const clampZoom = (z: number) => Math.max(0.6, Math.min(1.6, z))
// Lights were tuned with three's legacy (non-physical) intensities; π restores that brightness.
const LIGHT = Math.PI

type Label = THREE.Sprite & { setText: (l1: string, l2: string, col: string) => void }

function makeLabel(): Label {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 170
  const x = c.getContext('2d')!
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  const spr = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false }),
  ) as Label
  spr.scale.set(2, 0.665, 1)
  spr.renderOrder = 10
  let key = ''
  spr.setText = (l1, l2, col) => {
    const k = l1 + '|' + l2 + '|' + col
    if (k === key) return
    key = k
    x.clearRect(0, 0, 512, 170)
    x.textAlign = 'center'
    x.font = '700 56px "IBM Plex Sans KR",sans-serif'
    x.fillStyle = col
    x.fillText(l1, 256, 66)
    if (l2) {
      x.font = '500 42px "IBM Plex Sans KR",sans-serif'
      x.fillStyle = '#C9D4DF'
      x.fillText(l2, 256, 132)
    }
    tex.needsUpdate = true
  }
  return spr
}

const gauss = () => {
  let u = 0
  let v = 0
  while (!u) u = Math.random()
  while (!v) v = Math.random()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

type V3 = [number, number, number]
const lerp3 = (a: V3, b: V3, t: number): V3 => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
]
function along(path: V3[], u: number): V3 {
  const n = path.length - 1
  const x = Math.min(n - 1e-6, u * n)
  const i = Math.floor(x)
  return lerp3(path[i], path[i + 1], x - i)
}

interface Reservoir {
  group: THREE.Group
  mat: THREE.MeshStandardMaterial
  lab: Label
  light: THREE.PointLight
  edge: THREE.LineSegments<THREE.EdgesGeometry, THREE.LineBasicMaterial>
}

interface Bridge {
  mesh: THREE.Mesh
  mat: THREE.MeshStandardMaterial
  sg: number
  conn: number
}

interface Packet {
  mesh: THREE.Mesh
  m: THREE.MeshBasicMaterial
  phase: number
  z: number
  ex: number
  ez: number
  ey: number
}

export interface FrameContext {
  view: View
  fridge: boolean
  /** Temperature printed on each reservoir box (closed paths only). */
  reservoirT: { hot: number; cold: number } | null
}

export class EngineUnavailable extends Error {}

/**
 * The virtual heat engine: a glass cylinder of model particles under a piston, a hot and a cold
 * reservoir with sliding copper bridges, process props (weights, pins, gold insulation), orange
 * heat packets and a U-tube manometer. Ported from the approved blueprint.
 */
export class Engine {
  readonly speeds = new Float32Array(NP)
  vrms = vrmsAt(300)
  private lastT = 300
  /** Bumped whenever speeds are redrawn, so a histogram can drop its running average. */
  resamples = 0

  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera = new THREE.PerspectiveCamera(36, 1, 0.1, 60)
  private ro: ResizeObserver
  private yaw = 0.18
  private pitch = 0.3
  private dist = 9
  private hCur = hOfV(20)
  private props = { w: 0, p: 0, j: 0 }
  private flow = 0
  /** Packet travel clock; advances only while the playhead moves. */
  private pkT = 0
  private velF = 0
  private motion = 0
  private hOut = 0.95
  private manoReady = false
  private tmpC = new THREE.Color()
  private tmpC2 = new THREE.Color()
  private mat4 = new THREE.Matrix4()

  private piston!: THREE.Group
  private weights!: THREE.Group
  private wMat!: THREE.MeshStandardMaterial
  private wArrow!: THREE.ArrowHelper
  private pins!: THREE.Group
  private pinMat!: THREE.MeshStandardMaterial
  private jacket!: THREE.Group
  private jParts!: { mat: THREE.Material & { opacity: number } }[]
  private jMat!: THREE.MeshStandardMaterial
  private hot!: Reservoir
  private cold!: Reservoir
  private bridges!: Record<'hot' | 'cold', Bridge>
  private baseMat!: THREE.MeshStandardMaterial
  private packets: Packet[] = []
  private inst!: THREE.InstancedMesh
  private colL!: THREE.Mesh
  private colR!: THREE.Mesh
  private labDh!: Label
  private dhLine!: THREE.Mesh
  private readonly MANO = { MX1: 1.22, MX2: 1.56, MZ: 0.95, MYB: 0.55, MYT: 2.55 }
  private pos = new Float32Array(NP * 3)
  private vel = new Float32Array(NP * 3)
  private glow = new Float32Array(NP)
  private glowP = new Float32Array(NP)

  constructor(host: HTMLElement) {
    try {
      this.renderer = new THREE.WebGLRenderer({ antialias: true })
    } catch {
      throw new EngineUnavailable('WebGL is not available')
    }
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1))
    const cv = this.renderer.domElement
    host.prepend(cv)
    this.build()
    this.bindOrbit(cv)
    this.ro = new ResizeObserver(() => this.resize())
    this.ro.observe(cv)
    this.resize()
  }

  dispose() {
    this.ro.disconnect()
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }

  private resize() {
    const cv = this.renderer.domElement
    const w = cv.clientWidth
    const h = cv.clientHeight
    if (!w || !h) return
    this.renderer.setSize(w, h, false)
    const a = w / h
    this.camera.aspect = a
    // Narrower views pull back a little so the U-tube labels keep clear of the frame.
    this.dist = a < 1.1 ? 12.5 : 9 + Math.max(0, Math.min(0.6, 1.9 - a)) * 2.5
    this.camera.updateProjectionMatrix()
  }

  /** Extra zoom on top of the aspect-dependent distance, limited so the engine stays in view. */
  private zoom = 1

  /** Back to the default oblique view from slightly above. */
  resetView() {
    this.yaw = 0.18
    this.pitch = 0.3
    this.zoom = 1
  }

  /** Drag to orbit (one pointer), pinch or wheel to zoom, double-click to reset. */
  private bindOrbit(el: HTMLCanvasElement) {
    const pts = new Map<number, { x: number; y: number }>()
    let pinch = 0
    const spread = () => {
      const [a, b] = [...pts.values()]
      return Math.hypot(a.x - b.x, a.y - b.y)
    }
    el.addEventListener('pointerdown', (e) => {
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY })
      el.setPointerCapture(e.pointerId)
      if (pts.size === 2) pinch = spread()
    })
    el.addEventListener('pointermove', (e) => {
      const prev = pts.get(e.pointerId)
      if (!prev) return
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (pts.size === 2) {
        const d = spread()
        if (pinch) this.zoom = clampZoom(this.zoom * (pinch / d))
        pinch = d
        return
      }
      this.yaw -= (e.clientX - prev.x) * 0.008
      this.pitch = Math.max(0.05, Math.min(1.1, this.pitch + (e.clientY - prev.y) * 0.006))
    })
    const up = (e: PointerEvent) => {
      pts.delete(e.pointerId)
      pinch = 0
    }
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
    el.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault()
        this.zoom = clampZoom(this.zoom * Math.exp(e.deltaY * 0.001))
      },
      { passive: false },
    )
    el.addEventListener('dblclick', () => this.resetView())
  }

  private build() {
    const scene = this.scene
    scene.background = new THREE.Color(0x0b1118)
    scene.fog = new THREE.Fog(0x0b1118, 11, 22)
    scene.add(new THREE.HemisphereLight(0xcfe0ff, 0x151a22, 0.75 * LIGHT))
    const dl = new THREE.DirectionalLight(0xffffff, 0.85 * LIGHT)
    dl.position.set(3, 6, 5)
    scene.add(dl)
    const grid = new THREE.GridHelper(12, 24, 0x1f2c3a, 0x15202b)
    grid.position.y = -0.46
    scene.add(grid)

    // Two reservoirs: hot (left) and cold (right).
    const reservoir = (x: number, base: number, emis: number): Reservoir => {
      const group = new THREE.Group()
      const mat = new THREE.MeshStandardMaterial({
        color: base,
        roughness: 0.55,
        metalness: 0.1,
        emissive: emis,
        emissiveIntensity: 0.18,
      })
      const box = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, 1.2), mat)
      box.position.y = -0.06
      group.add(box)
      const edge = new THREE.LineSegments(
        new THREE.EdgesGeometry(box.geometry),
        new THREE.LineBasicMaterial({ color: emis, transparent: true, opacity: 0.5 }),
      )
      edge.position.copy(box.position)
      group.add(edge)
      const lab = makeLabel()
      lab.position.set(Math.sign(x) * 0.35, 0.95, 0)
      group.add(lab)
      const light = new THREE.PointLight(emis, 0, 4, 1)
      light.position.set(0, 0.6, 0.4)
      group.add(light)
      group.position.x = x
      scene.add(group)
      return { group, mat, lab, light, edge }
    }
    this.hot = reservoir(-RES_X, 0x5a2219, 0xff5a30)
    this.cold = reservoir(RES_X, 0x172f55, 0x3a8bff)

    // Insulating pedestal and conducting base plate.
    const ped = new THREE.Mesh(
      new THREE.CylinderGeometry(1.08, 1.2, 0.36, 48),
      new THREE.MeshStandardMaterial({ color: 0x222a33, roughness: 0.9 }),
    )
    ped.position.y = -0.28
    scene.add(ped)
    this.baseMat = new THREE.MeshStandardMaterial({
      color: 0x8a6a4a,
      metalness: 0.75,
      roughness: 0.35,
      emissive: 0x000000,
    })
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.04, 1.04, 0.1, 56), this.baseMat)
    base.position.y = -0.05
    scene.add(base)

    // Copper bridges that slide in to connect a reservoir to the base.
    const bridge = (k: 'hot' | 'cold', sg: number): Bridge => {
      const mat = new THREE.MeshStandardMaterial({
        color: 0xb87333,
        metalness: 0.8,
        roughness: 0.3,
        emissive: k === 'hot' ? 0xff5a30 : 0x3a8bff,
        emissiveIntensity: 0,
      })
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.1, 0.34), mat)
      mesh.position.set(sg * 1.36, -0.05, 0)
      scene.add(mesh)
      return { mesh, mat, sg, conn: 0 }
    }
    this.bridges = { hot: bridge('hot', -1), cold: bridge('cold', 1) }

    // Glass wall.
    const wallGeo = new THREE.CylinderGeometry(CYL_R, CYL_R, 3.2, 56, 1, true)
    const wall = new THREE.Mesh(
      wallGeo,
      new THREE.MeshStandardMaterial({
        color: 0x9fc3ff,
        transparent: true,
        opacity: 0.1,
        side: THREE.DoubleSide,
        depthWrite: false,
        roughness: 0.1,
      }),
    )
    wall.position.y = 1.6
    scene.add(wall)
    const rims = new THREE.LineSegments(
      new THREE.EdgesGeometry(wallGeo, 30),
      new THREE.LineBasicMaterial({ color: 0x7d98b8, transparent: true, opacity: 0.7 }),
    )
    rims.position.y = 1.6
    scene.add(rims)

    // Piston with weights (isobaric) and a work arrow.
    this.piston = new THREE.Group()
    const pMat = new THREE.MeshStandardMaterial({
      color: 0xa9b4bf,
      metalness: 0.85,
      roughness: 0.3,
    })
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.975, 0.975, 0.16, 56), pMat)
    head.position.y = 0.08
    this.piston.add(head)
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.8, 20), pMat)
    rod.position.y = 1.06
    this.piston.add(rod)
    this.weights = new THREE.Group()
    this.wMat = new THREE.MeshStandardMaterial({
      color: 0x2c6f63,
      metalness: 0.5,
      roughness: 0.45,
      transparent: true,
    })
    for (let i = 0; i < 3; i++) {
      const r = 0.6 - i * 0.07
      const w = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.16, 40), this.wMat)
      w.position.y = 0.25 + i * 0.17
      this.weights.add(w)
    }
    this.piston.add(this.weights)
    this.wArrow = new THREE.ArrowHelper(
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(0.45, 0.3, 0),
      0.7,
      0xdfe6ee,
      0.22,
      0.16,
    )
    this.piston.add(this.wArrow)
    scene.add(this.piston)

    this.buildManometer()

    // Pins (isochoric).
    this.pins = new THREE.Group()
    this.pinMat = new THREE.MeshStandardMaterial({
      color: 0xa286f2,
      metalness: 0.4,
      roughness: 0.4,
      emissive: 0x2a1a55,
      transparent: true,
    })
    for (const sgn of [-1, 1]) {
      const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 16), this.pinMat)
      pin.rotation.z = Math.PI / 2
      pin.position.set(sgn * 1.05, 0.08, 0)
      this.pins.add(pin)
      const clamp = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.3, 0.26), this.pinMat)
      clamp.position.set(sgn * 1.3, 0.08, 0)
      this.pins.add(clamp)
    }
    scene.add(this.pins)

    // Adiabatic jacket: quilted gold insulation foil, like spacecraft MLI.
    this.jacket = new THREE.Group()
    this.jMat = new THREE.MeshStandardMaterial({
      color: 0xd6a23c,
      metalness: 0.9,
      roughness: 0.28,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
      depthWrite: false,
      emissive: 0x4a3208,
      emissiveIntensity: 0.6,
    })
    const jw = new THREE.Mesh(new THREE.CylinderGeometry(1.17, 1.17, 3.45, 64, 1, true), this.jMat)
    jw.position.y = 1.55
    this.jacket.add(jw)
    const quiltMat = new THREE.LineBasicMaterial({
      color: 0xf7d98a,
      transparent: true,
      opacity: 0.4,
    })
    const quilt = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.CylinderGeometry(1.175, 1.175, 3.45, 22, 9, true), 1),
      quiltMat,
    )
    quilt.position.y = 1.55
    this.jacket.add(quilt)
    const skirtMat = new THREE.MeshStandardMaterial({
      color: 0xd6a23c,
      metalness: 0.9,
      roughness: 0.3,
      transparent: true,
      opacity: 0.95,
      emissive: 0x4a3208,
      emissiveIntensity: 0.5,
    })
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(1.24, 1.3, 0.42, 64), skirtMat)
    skirt.position.y = -0.24
    this.jacket.add(skirt)
    this.jParts = [{ mat: this.jMat }, { mat: quiltMat }, { mat: skirtMat }]
    scene.add(this.jacket)

    // Heat packets travelling reservoir ⇄ bridge ⇄ gas (always orange; direction = sign of Q).
    const pkGeo = new THREE.SphereGeometry(0.075, 12, 10)
    for (let i = 0; i < 22; i++) {
      const m = new THREE.MeshBasicMaterial({
        color: 0xffa060,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
      const mesh = new THREE.Mesh(pkGeo, m)
      scene.add(mesh)
      const a = Math.random() * Math.PI * 2
      const r = 0.2 + Math.random() * 0.6
      this.packets.push({
        mesh,
        m,
        phase: i / 22,
        z: (Math.random() - 0.5) * 0.24,
        ex: Math.cos(a) * r,
        ez: Math.sin(a) * r,
        ey: 0.25 + Math.random() * 0.5,
      })
    }

    // Particles.
    const pGeo = new THREE.SphereGeometry(0.036, 10, 8)
    const pm = new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0, emissive: 0x111111 })
    this.inst = new THREE.InstancedMesh(pGeo, pm, NP)
    // The particles move every frame; a bounding sphere cached from one frame would cull them all.
    this.inst.frustumCulled = false
    for (let i = 0; i < NP; i++) this.inst.setColorAt(i, this.tmpC.set(0xffffff))
    scene.add(this.inst)
    const { pos } = this
    for (let i = 0; i < NP; i++) {
      const a = Math.random() * Math.PI * 2
      const r = Math.sqrt(Math.random()) * 0.9
      pos[i * 3] = Math.cos(a) * r
      pos[i * 3 + 1] = 0.05 + Math.random() * 1.2
      pos[i * 3 + 2] = Math.sin(a) * r
    }
    this.resample(300)
  }

  /** Redraw every velocity from the Maxwell distribution at T (after a jump in temperature). */
  private resample(T: number) {
    const a = vrmsAt(T) / Math.sqrt(3)
    const { vel } = this
    for (let k = 0; k < NP * 3; k++) vel[k] = a * gauss()
    this.lastT = T
    this.resamples++
  }

  /**
   * U-tube mercury manometer at the front right: a hose from the gas below the piston feeds the
   * left arm; the right arm is open to the outside.
   */
  private buildManometer() {
    const { MX1, MX2, MZ, MYB, MYT } = this.MANO
    const mano = new THREE.Group()
    const glassM = new THREE.MeshStandardMaterial({
      color: 0xcfe3ff,
      transparent: true,
      opacity: 0.22,
      side: THREE.DoubleSide,
      depthWrite: false,
      roughness: 0.1,
    })
    const hgM = new THREE.MeshStandardMaterial({
      color: 0xf2f6fa,
      metalness: 0.6,
      roughness: 0.25,
      emissive: 0x8a96a3,
      emissiveIntensity: 0.55,
    })
    for (const x of [MX1, MX2]) {
      const t = new THREE.Mesh(
        new THREE.CylinderGeometry(0.085, 0.085, MYT - MYB, 18, 1, true),
        glassM,
      )
      t.position.set(x, (MYT + MYB) / 2, MZ)
      mano.add(t)
    }
    const bendR = (MX2 - MX1) / 2
    const bend = new THREE.Mesh(new THREE.TorusGeometry(bendR, 0.075, 12, 24, Math.PI), glassM)
    bend.rotation.z = Math.PI
    bend.position.set((MX1 + MX2) / 2, MYB, MZ)
    mano.add(bend)
    const bendHg = new THREE.Mesh(new THREE.TorusGeometry(bendR, 0.07, 12, 24, Math.PI), hgM)
    bendHg.rotation.z = Math.PI
    bendHg.position.copy(bend.position)
    mano.add(bendHg)
    this.colL = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1, 18), hgM)
    this.colR = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1, 18), hgM)
    this.colL.position.set(MX1, 0, MZ)
    this.colR.position.set(MX2, 0, MZ)
    mano.add(this.colL, this.colR)
    const board = new THREE.Mesh(
      new THREE.PlaneGeometry(0.62, MYT - MYB + 0.2),
      new THREE.MeshStandardMaterial({
        color: 0x1b2530,
        roughness: 0.9,
        transparent: true,
        opacity: 0.85,
      }),
    )
    board.position.set((MX1 + MX2) / 2, (MYT + MYB) / 2, MZ - 0.1)
    mano.add(board)
    const ticks: THREE.Vector3[] = []
    for (let y = MYB + 0.2; y < MYT; y += 0.2)
      ticks.push(
        new THREE.Vector3(MX1 - 0.2, y, MZ - 0.09),
        new THREE.Vector3(MX1 - 0.12, y, MZ - 0.09),
        new THREE.Vector3(MX2 + 0.12, y, MZ - 0.09),
        new THREE.Vector3(MX2 + 0.2, y, MZ - 0.09),
      )
    mano.add(
      new THREE.LineSegments(
        new THREE.BufferGeometry().setFromPoints(ticks),
        new THREE.LineBasicMaterial({ color: 0x5a6b7c }),
      ),
    )
    const hose = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.62, 0.22, 0.78),
      new THREE.Vector3(0.95, 0.24, 0.95),
      new THREE.Vector3(0.98, 1.6, 1.0),
      new THREE.Vector3(1.0, 2.8, 0.98),
      new THREE.Vector3(MX1, 2.85, MZ),
      new THREE.Vector3(MX1, MYT, MZ),
    ])
    mano.add(
      new THREE.Mesh(
        new THREE.TubeGeometry(hose, 48, 0.035, 10, false),
        new THREE.MeshStandardMaterial({
          color: 0x7fb0d8,
          transparent: true,
          opacity: 0.55,
          roughness: 0.4,
        }),
      ),
    )
    const labGas = makeLabel()
    labGas.scale.set(1.9, 0.63, 1)
    labGas.position.set(MX1 - 0.1, 3.02, MZ)
    labGas.setText('기체 쪽', '', '#9FD4FF')
    mano.add(labGas)
    const labOut = makeLabel()
    // The drawing exaggerates the level difference; the note stays on screen with the tube.
    labOut.scale.set(1.9, 0.63, 1)
    labOut.position.set(MX2 + 0.3, MYT + 0.16, MZ)
    labOut.setText('바깥 쪽', 'Δh 크게 그림', '#E8C070')
    mano.add(labOut)
    this.labDh = makeLabel()
    this.labDh.scale.set(1.2, 0.4, 1)
    this.labDh.setText('Δh', '', '#FFD08A')
    mano.add(this.labDh)
    this.dhLine = new THREE.Mesh(
      new THREE.BoxGeometry(0.03, 1, 0.03).translate(0, 0.5, 0),
      new THREE.MeshBasicMaterial({ color: 0xffd08a }),
    )
    mano.add(this.dhLine)
    this.scene.add(mano)
  }

  /** Advance the scene by dt seconds and draw it. */
  frame(dt: number, ctx: FrameContext) {
    const { view: v, fridge, reservoirT } = ctx
    const { st, type } = v
    const tnow = performance.now() / 1000
    const k6 = Math.min(1, dt * 6)

    // A seek, a new example, a gas change or a shared link jumps the state. Set the piston and
    // redraw speeds from Maxwell's distribution at once: rescaling leaves a two-humped histogram,
    // and a sliding piston would squeeze (and heat) only the particles it meets.
    const hTarget = hOfV(st.V)
    if (Math.abs(hTarget - this.hCur) > 0.3 || Math.abs(st.T - this.lastT) > 0.15 * this.lastT) {
      this.hCur = hTarget
      const { pos } = this
      for (let i = 0; i < NP; i++)
        if (pos[i * 3 + 1] > hTarget - 0.04) pos[i * 3 + 1] = 0.05 + Math.random() * (hTarget - 0.1)
      this.resample(st.T)
    }
    // Piston follows the volume; its velocity is clamped so a big jump cannot blow up the gas.
    const hPrev = this.hCur
    this.hCur += (hOfV(st.V) - this.hCur) * Math.min(1, dt * 14)
    const pv = Math.max(-1.5, Math.min(1.5, (this.hCur - hPrev) / (dt || 1 / 60)))
    this.piston.position.y = this.hCur

    // Process props fade in and out.
    const want = {
      w: type === 'isobaric' ? 1 : 0,
      p: type === 'isochoric' ? 1 : 0,
      j: type === 'adiabatic' ? 1 : 0,
    }
    this.props.w += (want.w - this.props.w) * k6
    this.props.p += (want.p - this.props.p) * k6
    this.props.j += (want.j - this.props.j) * k6
    this.weights.visible = this.props.w > 0.02
    this.weights.scale.setScalar(0.6 + 0.4 * this.props.w)
    this.wMat.opacity = this.props.w
    this.pins.visible = this.props.p > 0.02
    this.pins.position.y = this.hCur
    this.pinMat.opacity = this.props.p
    this.pins.scale.set(0.6 + 0.4 * this.props.p, 1, 1)
    const jj = this.props.j
    this.jacket.visible = jj > 0.02
    const jOp = [0.3, 0.4, 0.95]
    this.jParts.forEach((p, i) => (p.mat.opacity = jOp[i] * jj))
    this.jacket.scale.set(1 + 0.08 * (1 - jj), 1, 1 + 0.08 * (1 - jj))
    this.jMat.emissiveIntensity = 0.45 + 0.2 * Math.sin(tnow * 2.2)

    // Outside pressure. While the piston moves the imbalance is exaggerated in proportion to its
    // speed, so it is zero at rest and at every segment boundary and P_ext never jumps. In an
    // isochoric step the pins hold the piston: the outside keeps its starting pressure, then
    // blends to the gas pressure over the last 30% before the pins release.
    const mv = v.moving ? v.vdir : 0
    // The speed profile itself is used unsmoothed, so the imbalance is exactly zero when the
    // piston stops at a boundary; only pausing and resuming fade it, through `motion`.
    this.motion += ((v.live && v.moving ? 1 : 0) - this.motion) * Math.min(1, dt * 8)
    const speed = type !== 'isochoric' ? (6 * v.tau * (1 - v.tau)) / 1.5 : 0
    this.velF = speed * this.motion
    let Pext: number
    if (type === 'isochoric' && v.live) {
      const r = easeS(Math.max(0, Math.min(1, (v.tau - 0.7) / 0.3)))
      Pext = v.Pstart + (st.P - v.Pstart) * r
    } else Pext = st.P * (1 - 0.5 * v.vdir * this.velF)

    // Manometer: each arm's mercury level follows its own side's pressure (higher pressure, lower
    // level), so the gas arm moves exactly as continuously as the gas pressure does. Only the
    // outside arm may move quickly, and it is eased so it never teleports. Δh = P − P_ext.
    {
      const M = this.MANO
      const level = (p: number) => Math.max(0.08, Math.min(1.9, 1.85 - (1.7 * p) / PMAX))
      const hl = level(st.P)
      this.hOut += (level(v.live ? Pext : st.P) - this.hOut) * Math.min(1, dt * 10)
      if (!this.manoReady) {
        this.hOut = hl
        this.manoReady = true
      }
      const hr = this.hOut
      this.colL.scale.y = hl
      this.colL.position.y = M.MYB + hl / 2
      this.colR.scale.y = hr
      this.colR.position.y = M.MYB + hr / 2
      const yl = M.MYB + hl
      const yr = M.MYB + hr
      const xm = M.MX2 + 0.2
      this.dhLine.visible = Math.abs(hr - hl) > 0.05
      this.dhLine.position.set(xm, Math.min(yl, yr), M.MZ)
      this.dhLine.scale.y = Math.abs(yr - yl) || 0.001
      this.labDh.visible = this.dhLine.visible
      this.labDh.position.set(xm + 0.2, (yl + yr) / 2, M.MZ)
    }

    // Heat: which reservoir, which way, how strong.
    // Direction and reservoir come from the whole segment, so they hold while paused and at the
    // segment boundaries where the rate passes through zero; only the strength follows the rate.
    const dir = v.heat
    const inten = v.moving ? Math.max(0.2, Math.min(1, Math.abs(v.dq) * 1.3)) : 0.45
    const side = dir ? v.side : null
    if (v.moving) this.pkT += dt * (0.28 + 0.35 * inten)
    this.flow += ((side ? 1 : 0) - this.flow) * Math.min(1, dt * 5)
    for (const k of ['hot', 'cold'] as const) {
      const br = this.bridges[k]
      const on = side === k && type !== 'adiabatic' ? 1 : 0
      br.conn += (on - br.conn) * k6
      br.mesh.position.x = br.sg * (1.36 + 0.32 * (1 - br.conn))
      br.mat.emissiveIntensity = br.conn * (0.35 + 0.5 * inten)
      const R = this[k]
      R.mat.emissiveIntensity = 0.18 + br.conn * (0.35 + 0.45 * inten + 0.1 * Math.sin(tnow * 5))
      R.light.intensity = br.conn * 1.6 * Math.max(0.4, inten) * LIGHT
      R.edge.material.opacity = 0.35 + 0.55 * br.conn
      const name =
        k === 'hot'
          ? fridge
            ? '고온부 (실외)'
            : '고온 열원'
          : fridge
            ? '저온부 (실내)'
            : '저온 열원'
      const col = k === 'hot' ? '#FF8A6A' : '#7FB4FF'
      // The temperature stays while connected: "1083 K > gas" is the point of the second law.
      // Which way heat goes is already shown by the chip and the grains on the bridge.
      R.lab.setText(name, reservoirT ? `${Math.round(reservoirT[k])} K 부근` : '', col)
    }
    this.baseMat.emissive.setHex(side ? 0xff7a30 : 0x000000)
    this.baseMat.emissiveIntensity = 0.5 * inten * this.flow

    // Packets travel reservoir → bridge → base → gas, or the reverse.
    const sg = side === 'hot' ? -1 : 1
    for (const p of this.packets) {
      if (!side || type === 'adiabatic') {
        p.m.opacity *= 0.85
        continue
      }
      const path: V3[] = [
        [sg * RES_X, 0.1, p.z],
        [sg * RES_X * 0.82, 0.12, p.z],
        [sg * 1.62, -0.02, p.z],
        [sg * 0.95, -0.02, p.z],
        [p.ex * 0.6, 0.05, p.ez * 0.6],
        [p.ex, p.ey, p.ez],
      ]
      // Packets advance only while playing: a paused frame freezes them in place.
      let u = (this.pkT + p.phase) % 1
      if (dir < 0) u = 1 - u
      const q = along(path, u)
      p.mesh.position.set(q[0], q[1], q[2])
      const fade = dir > 0 ? Math.min(1, (1 - u) * 4, u * 6) : Math.min(1, u * 4, (1 - u) * 6)
      p.m.opacity = fade * (0.45 + 0.5 * inten)
      p.mesh.scale.setScalar(0.8 + 0.5 * inten)
    }

    // Work arrow on the piston.
    if (Math.abs(v.dw) > 0.02 && v.moving) {
      const up = v.dw > 0
      this.wArrow.visible = true
      this.wArrow.setDirection(new THREE.Vector3(0, up ? 1 : -1, 0))
      this.wArrow.position.set(0.5, up ? 0.3 : 1.1, 0)
    } else this.wArrow.visible = false

    this.stepParticles(dt, st.T, pv, mv, type, !!side && type !== 'adiabatic')

    const c = this.camera
    const tgt = new THREE.Vector3(0, 0.95, 0)
    c.position.set(
      tgt.x + this.dist * this.zoom * Math.cos(this.pitch) * Math.sin(this.yaw),
      tgt.y + this.dist * this.zoom * Math.sin(this.pitch),
      tgt.z + this.dist * this.zoom * Math.cos(this.pitch) * Math.cos(this.yaw),
    )
    c.lookAt(tgt)
    this.renderer.render(this.scene, c)
  }

  /**
   * Model particles: speeds are thermostatted towards the rms speed for T, a few velocities are
   * redrawn from the Maxwell distribution each frame (a stand-in for collisions), and they bounce
   * off the wall, the base and the moving piston. A base hit during heat flow flashes orange; a hit
   * on a receding piston flashes blue (slowed) and on an advancing one red (sped up).
   */
  private stepParticles(
    dt: number,
    T: number,
    pv: number,
    mv: number,
    type: View['type'],
    heatOn: boolean,
  ) {
    // Jumps were handled in frame(); playback changes T by far less than 15% per frame.
    this.lastT = T
    const vrms = vrmsAt(T)
    this.vrms = vrms
    const H = this.hCur
    const r2 = 0.94 * 0.94
    const rad = 0.036
    const { pos, vel, glow, glowP } = this
    let sum = 0
    for (let i = 0; i < NP; i++) {
      const k = i * 3
      sum += vel[k] * vel[k] + vel[k + 1] * vel[k + 1] + vel[k + 2] * vel[k + 2]
    }
    const cur = Math.sqrt(sum / NP) || 1
    const fac = Math.pow(vrms / cur, Math.min(1, dt * 5))
    const pistonFlash = mv !== 0 && (type === 'adiabatic' || type === 'isothermal')
    for (let i = 0; i < NP; i++) {
      const k = i * 3
      vel[k] *= fac
      vel[k + 1] *= fac
      vel[k + 2] *= fac
      if (Math.random() < dt * 0.6) {
        const a = vrms / Math.sqrt(3)
        vel[k] = a * gauss()
        vel[k + 1] = a * gauss()
        vel[k + 2] = a * gauss()
      }
      pos[k] += vel[k] * dt
      pos[k + 1] += vel[k + 1] * dt
      pos[k + 2] += vel[k + 2] * dt
      const x = pos[k]
      const z = pos[k + 2]
      const rr = x * x + z * z
      if (rr > r2) {
        const r = Math.sqrt(rr)
        const nx = x / r
        const nz = z / r
        const vn = vel[k] * nx + vel[k + 2] * nz
        if (vn > 0) {
          vel[k] -= 2 * vn * nx
          vel[k + 2] -= 2 * vn * nz
        }
        pos[k] = nx * 0.94
        pos[k + 2] = nz * 0.94
      }
      if (pos[k + 1] < rad) {
        pos[k + 1] = rad
        if (vel[k + 1] < 0) {
          vel[k + 1] = -vel[k + 1]
          if (heatOn) glow[i] = 1
        }
      }
      const top = H - rad
      if (pos[k + 1] > top) {
        pos[k + 1] = top - Math.random() * 0.02
        if (vel[k + 1] > pv) {
          vel[k + 1] = 2 * pv - vel[k + 1]
          if (pistonFlash) glowP[i] = 1
        }
      }
      glow[i] = Math.max(0, glow[i] - dt * 2.2)
      glowP[i] = Math.max(0, glowP[i] - dt * 1.8)
      this.mat4.makeTranslation(pos[k], pos[k + 1], pos[k + 2])
      this.inst.setMatrixAt(i, this.mat4)
      const sp = Math.sqrt(vel[k] * vel[k] + vel[k + 1] * vel[k + 1] + vel[k + 2] * vel[k + 2])
      this.speeds[i] = sp
      speedColor(speedU(sp), this.tmpC)
      if (glow[i] > 0) this.tmpC.lerp(this.tmpC2.setHex(0xffc080), glow[i] * 0.85)
      if (glowP[i] > 0)
        this.tmpC.lerp(this.tmpC2.setHex(mv > 0 ? 0x2f6fff : 0xff3b2f), glowP[i] * 0.9)
      this.inst.setColorAt(i, this.tmpC)
    }
    this.inst.instanceMatrix.needsUpdate = true
    if (this.inst.instanceColor) this.inst.instanceColor.needsUpdate = true
  }
}

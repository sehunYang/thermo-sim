<script lang="ts">
  import { Color } from 'three'
  import { onMount } from 'svelte'
  import { Engine } from '../engine3d/engine'
  import { SPEED_MAX, speedColor, speedU } from '../engine3d/speed'
  import { LIMITS } from '../physics/path'
  import { PROC, f0, f1, fmtE } from '../i18n/ko'
  import { sim } from '../store/simulation.svelte'
  import WhyRow from './WhyRow.svelte'

  let host: HTMLElement
  let hist = $state<HTMLCanvasElement>()
  let failed = $state(false)
  let Pext = $state<number | null>(null)
  let resetView = $state<() => void>(() => {})

  const v = $derived(sim.view)
  const pr = $derived(PROC[v.type])
  const where = (side: 'hot' | 'cold') =>
    side === 'hot'
      ? sim.fridge
        ? '고온부(실외)'
        : '고온 열원'
      : sim.fridge
        ? '저온부(실내)'
        : '저온 열원'
  const heat = $derived.by(() => {
    if (v.type === 'adiabatic') return { tag: '단열: 열 출입 없음', col: '#F7D98A', val: 'Q = 0' }
    if (!v.heat || !v.side) return { tag: '열 출입 없음', col: '', val: 'Q = 0' }
    const w = where(v.side)
    return {
      tag: v.heat > 0 ? `${w} → 기체: 열 받음` : `기체 → ${w}: 열 잃음`,
      col: '#FFA060',
      val: `Q ${fmtE(v.Q)} J`,
    }
  })
  const work = $derived.by(() => {
    if (v.type === 'isochoric') return { tag: '피스톤 고정', col: '', val: 'W = 0' }
    return v.work >= 0
      ? { tag: '▲ 기체가 일함', col: '#4CC06C', val: `W ${fmtE(v.W)} J` }
      : { tag: '▼ 기체가 일을 받음', col: '#F0924A', val: `W ${fmtE(v.W)} J` }
  })
  const pct = (x: number, max: number) => `${Math.min(100, Math.max(0, (x / max) * 100))}%`

  /** Speed histogram: bars from the particles, curve from Maxwell's distribution at T. */
  const tmp = new Color()
  function drawHist(engine: Engine) {
    const cv = hist
    if (!cv) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const W = cv.clientWidth
    const H = cv.clientHeight
    if (!W) return
    if (cv.width !== W * dpr) {
      cv.width = W * dpr
      cv.height = H * dpr
    }
    const x = cv.getContext('2d')!
    x.setTransform(dpr, 0, 0, dpr, 0, 0)
    x.clearRect(0, 0, W, H)
    const NB = 24
    const bins = new Array<number>(NB).fill(0)
    for (const s of engine.speeds) bins[Math.min(NB - 1, Math.floor(speedU(s) * NB))]++
    const a2 = (engine.vrms * engine.vrms) / 3
    const curve: number[] = []
    for (let i = 0; i <= 60; i++) {
      const vv = (i / 60) * SPEED_MAX
      curve.push(vv * vv * Math.exp((-vv * vv) / (2 * a2)))
    }
    const bmax = Math.max(...bins, 1)
    const bw = W / NB
    const top = 4
    const hh = H - top - 2
    bins.forEach((n, i) => {
      speedColor((i + 0.5) / NB, tmp)
      x.fillStyle = `rgb(${(tmp.r * 255) | 0},${(tmp.g * 255) | 0},${(tmp.b * 255) | 0})`
      const h = (n / bmax) * hh
      x.fillRect(i * bw + 0.5, H - 2 - h, bw - 1, h)
    })
    const pk = Math.max(...curve) || 1
    const sc = hh / pk
    x.beginPath()
    curve.forEach((p, i) => {
      const px = (i / 60) * W
      const py = H - 2 - p * sc * 0.98
      if (i) x.lineTo(px, py)
      else x.moveTo(px, py)
    })
    x.strokeStyle = 'rgba(255,255,255,.85)'
    x.lineWidth = 1.3
    x.stroke()
    const vx = speedU(engine.vrms) * W
    x.strokeStyle = 'rgba(255,255,255,.5)'
    x.setLineDash([2, 2])
    x.beginPath()
    x.moveTo(vx, top)
    x.lineTo(vx, H - 2)
    x.stroke()
    x.setLineDash([])
  }

  onMount(() => {
    // Without WebGL the graph and panel still play; only the 3D scene is missing.
    let created: Engine | null = null
    try {
      created = new Engine(host)
    } catch {
      failed = true
    }
    const engine = created
    // Skip drawing while the 3D pane is scrolled out of view (phones); playback keeps ticking.
    // requestAnimationFrame itself stops while the tab is hidden.
    let onScreen = true
    const io = new IntersectionObserver(([e]) => (onScreen = e.isIntersecting))
    io.observe(host)
    resetView = () => engine?.resetView()
    let raf = 0
    let last = performance.now()
    let frame = 0
    const loop = (now: number) => {
      // The first frame's timestamp can be older than `last` when start-up work (a shared link)
      // kept the main thread busy; a negative step would fling the piston and particles away.
      const dt = Math.max(0, Math.min(0.05, (now - last) / 1000))
      last = now
      sim.tick(dt)
      if (engine && onScreen) {
        engine.frame(dt, {
          view: sim.view,
          fridge: sim.fridge,
          reservoirT: sim.reservoirT,
        })
        Pext = engine.Pext
        if (frame++ % 3 === 0) drawHist(engine)
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      io.disconnect()
      engine?.dispose()
    }
  })
</script>

<div class="engine-col">
  <section class="engine-pane" aria-label="가상 열기관" bind:this={host}>
    {#if failed}
      <div class="engine-fallback">
        이 기기에서는 3D(WebGL)를 쓸 수 없어요. 그래프와 에너지 표는 그대로 쓸 수 있어요.
      </div>
    {:else}
      <div class="hud">
        {#if !v.empty}
          <div class="hud-proc">
            <span class="chip"
              ><span class="dot" style="background:var({pr.cssVar})"></span><span>{pr.full}</span
              ></span
            >
            {#if v.live}
              <span class="chip small"
                ><span style:color={heat.col || null}>{heat.tag}</span>&nbsp;{heat.val}</span
              >
              <span class="chip small" id="hudWork"
                ><span style:color={work.col || null}>{work.tag}</span>&nbsp;{work.val}</span
              >
            {/if}
          </div>
          <div class="gauges">
            <div class="gauge">
              <div class="gauge-top">
                <span class="gauge-k">기체 압력 P</span><span class="gauge-v">{f0(v.st.P)} kPa</span
                >
              </div>
              <div class="gauge-bar"><i style="width:{pct(v.st.P, LIMITS.Pmax)}"></i></div>
            </div>
            <div class="gauge">
              <div class="gauge-top">
                <span class="gauge-k" title="움직이는 동안 차이를 과장해 표시">바깥 압력*</span
                ><span class="gauge-v">{Pext == null ? '–' : f0(Pext) + ' kPa'}</span>
              </div>
              <div class="gauge-bar">
                <i style="width:{Pext == null ? '0%' : pct(Pext, LIMITS.Pmax)};background:#E8C070"
                ></i>
              </div>
            </div>
            <div class="gauge">
              <div class="gauge-top">
                <span class="gauge-k">부피 V</span><span class="gauge-v">{f1(v.st.V)} L</span>
              </div>
              <div class="gauge-bar"><i style="width:{pct(v.st.V, LIMITS.Vmax)}"></i></div>
            </div>
            <div class="gauge">
              <div class="gauge-top">
                <span class="gauge-k">온도 T</span><span class="gauge-v">{f0(v.st.T)} K</span>
              </div>
              <div class="gauge-bar">
                <i
                  style="width:{pct(
                    v.st.T,
                    1500,
                  )};background:linear-gradient(90deg,#3b82f6,#f59e0b,#ef4444)"
                ></i>
              </div>
            </div>
          </div>
        {/if}
        <div class="hud-legend">
          <div class="row"><span>입자 속력 분포</span><span>- - 평균(√v²)</span></div>
          <canvas bind:this={hist} aria-label="입자 속력 분포 히스토그램"></canvas>
          <div class="axis">
            <span>느림</span><span>입자 색 = 그 입자의 속력</span><span>빠름</span>
          </div>
        </div>
        <div class="hud-hint">
          끌어서 회전 · 휠로 확대
          <button class="hud-reset" onclick={() => resetView()}>시점 초기화</button>
        </div>
      </div>
    {/if}
  </section>
  <WhyRow />
</div>

<script lang="ts">
  import { Color } from 'three'
  import { onMount } from 'svelte'
  import { Engine } from '../engine3d/engine'
  import { SPEED_MAX, speedColor, speedU } from '../engine3d/speed'
  import { f0, f1 } from '../i18n/ko'
  import { sim } from '../store/simulation.svelte'
  import WhyRow from './WhyRow.svelte'

  let host: HTMLElement
  let hist = $state<HTMLCanvasElement>()
  let failed = $state(false)
  let resetView = $state<() => void>(() => {})
  // The reset button only appears once the view has been turned or zoomed.
  let moved = $state(false)

  const v = $derived(sim.view)
  /** The gas state in one quiet line: the same numbers the table shows at segment ends. */
  const gasLine = $derived(`P ${f0(v.st.P)} kPa   V ${f1(v.st.V)} L   T ${f0(v.st.T)} K`)

  /** Speed histogram: bars from the particles, curve from Maxwell's distribution at T. */
  const tmp = new Color()
  let avg: number[] = []
  let seen = -1
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
    const NB = 20
    const bins = new Array<number>(NB).fill(0)
    for (const s of engine.speeds) bins[Math.min(NB - 1, Math.floor(speedU(s) * NB))]++
    // 300 particles give ragged bars frame to frame; a short running average shows the shape the
    // curve predicts. Start over when the engine redraws the speeds after a temperature jump.
    if (engine.resamples !== seen || avg.length !== NB) {
      seen = engine.resamples
      avg = bins.slice()
    } else for (let i = 0; i < NB; i++) avg[i] += (bins[i] - avg[i]) * 0.15
    const a2 = (engine.vrms * engine.vrms) / 3
    const curve: number[] = []
    for (let i = 0; i <= 60; i++) {
      const vv = (i / 60) * SPEED_MAX
      curve.push(vv * vv * Math.exp((-vv * vv) / (2 * a2)))
    }
    const bmax = Math.max(...avg, 1)
    const bw = W / NB
    const top = 4
    const hh = H - top - 2
    avg.forEach((n, i) => {
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
    if (engine) engine.onView = (m) => (moved = m)
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
          <output class="hud-state" aria-label="지금 기체 상태">{gasLine}</output>
        {/if}
        {#if moved}
          <button
            class="hud-reset"
            title="시점 초기화 (끌어서 회전 · 휠로 확대)"
            aria-label="시점 초기화"
            onclick={() => resetView()}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"
              ><path
                d="M2.5 8a5.5 5.5 0 109.6-3.7M12.5 1.8v2.8H9.7"
                fill="none"
                stroke="currentColor"
                stroke-width="1.4"
                stroke-linecap="round"
                stroke-linejoin="round"
              /><circle cx="8" cy="8" r="1.4" fill="currentColor" /></svg
            >
          </button>
        {/if}
      </div>
    {/if}
  </section>
  <div class="below">
    <WhyRow />
    <figure class="hist">
      <figcaption><span>입자 속력 분포</span><span>- - 평균</span></figcaption>
      <canvas bind:this={hist} aria-label="입자 속력 분포 히스토그램"></canvas>
      <div class="axis"><span>느림</span><span>빠름</span></div>
    </figure>
  </div>
</div>

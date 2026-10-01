<script lang="ts">
  import { R, temperature } from '../physics/gas'
  import { LIMITS } from '../physics/path'
  import { energy, stateBetween } from '../physics/processes'
  import {
    G,
    PH,
    PMAX,
    PW,
    Py,
    VMAX,
    Vx,
    adiabatPts,
    computeGhost,
    isothermPts,
    pathD,
    sampleSegment,
    snapP,
    snapV,
    xV,
    yP,
    type Ghost,
    type Pt,
  } from '../graph/geometry'
  import { LETTERS, PROC, f0, f1 } from '../i18n/ko'
  import { sim } from '../store/simulation.svelte'
  import type { ResolvedSegment } from '../physics/path'

  let svg: SVGSVGElement
  let host: HTMLDivElement
  let hover = $state<{ V: number; P: number } | null>(null)
  let readout = $state<{ x: number; y: number; flip: boolean; text: string } | null>(null)
  let ghost = $state<Ghost | null>(null)
  let dragging = false

  const mono = 'IBM Plex Mono,monospace'
  const vTicks = Array.from({ length: VMAX / 5 }, (_, i) => (i + 1) * 5)
  const pTicks = Array.from({ length: PMAX / 50 }, (_, i) => (i + 1) * 50)
  const isoTemps = [200, 400, 600, 800, 1000, 1200, 1400]

  const segPts = (r: ResolvedSegment) => sampleSegment(sim.gas, r.segment.type, r.a, r.b)

  function arrow(r: ResolvedSegment, s: number) {
    const st = (u: number) => stateBetween(sim.gas, r.segment.type, r.a, r.b, u)
    const p0 = st(Math.max(0, s - 0.02))
    const p1 = st(Math.min(1, s + 0.02))
    const m = st(s)
    const ang = (Math.atan2(yP(p1.P) - yP(p0.P), xV(p1.V) - xV(p0.V)) * 180) / Math.PI
    return `translate(${xV(m.V).toFixed(1)} ${yP(m.P).toFixed(1)}) rotate(${ang.toFixed(1)})`
  }

  const P = $derived(sim.play)
  const cur = $derived(P.active && sim.resolved.length ? P.seg : -1)
  const cycleArea = $derived(
    sim.closed && (sim.tab === 'cycle' || (P.done && !P.playing))
      ? pathD(sim.resolved.flatMap(segPts)) + 'z'
      : '',
  )
  // Area under the current segment so far (the work done so far), coloured by its sign.
  const workArea = $derived.by(() => {
    if (cur < 0 || P.done) return null
    const r = sim.resolved[cur]
    if (r.segment.type === 'isochoric' || P.s <= 0.001) return null
    const pts = sampleSegment(sim.gas, r.segment.type, r.a, r.b, 0, P.s, 40)
    const W = energy(
      sim.gas,
      r.segment.type,
      r.a,
      stateBetween(sim.gas, r.segment.type, r.a, r.b, P.s),
    ).W
    const poly: Pt[] = [...pts, [pts[pts.length - 1][0], G.T + PH], [pts[0][0], G.T + PH]]
    return { d: pathD(poly) + 'z', col: W >= 0 ? 'var(--work-pos)' : 'var(--work-neg)' }
  })
  const marker = $derived(
    cur >= 0
      ? stateBetween(
          sim.gas,
          sim.resolved[cur].segment.type,
          sim.resolved[cur].a,
          sim.resolved[cur].b,
          P.s,
        )
      : null,
  )

  const vertices = $derived.by(() => {
    if (!sim.start) return []
    const pts = [sim.start, ...sim.resolved.map((r) => r.b)]
    return (sim.closed ? pts.slice(0, -1) : pts).map((p, i) => {
      const x = xV(p.V)
      const y = yP(p.P)
      const right = x > G.L + PW - 30
      return { x, y, lx: x + (right ? -10 : 9), anchor: right ? 'end' : 'start', label: LETTERS[i] }
    })
  })

  const status = $derived.by(() => {
    if (P.active && P.done)
      return sim.closed ? '한 바퀴 완료 · 파란 영역이 알짜 일이에요' : '재생 완료'
    if (cur >= 0) {
      const r = sim.resolved[cur]
      const to = sim.closed && cur === sim.resolved.length - 1 ? 'A' : LETTERS[cur + 1]
      return `${LETTERS[cur]}→${to} ${PROC[r.segment.type].full} 재생 중`
    }
    if (!sim.start) return '그래프를 눌러 시작 상태 A를 찍으세요'
    if (sim.closed) return '순환이 닫혔어요 · 실행을 눌러 보세요'
    if (ghost && !ghost.valid) return ghost.why || '범위를 벗어났어요'
    if (ghost?.closing) return '놓으면 A로 돌아와 순환이 닫혀요'
    return `${PROC[sim.tool].name} 도구 · 끌거나 눌러서 다음 상태를 정하세요`
  })

  // Drop a stale preview when the path or tool changes underneath it.
  $effect(() => {
    void sim.tool
    void sim.lastState
    if (!dragging) ghost = null
  })

  function svgPoint(e: PointerEvent) {
    const pt = svg.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    return pt.matrixTransform(svg.getScreenCTM()!.inverse())
  }

  function ghostAt(px: number, py: number, snapOff: boolean): Ghost | null {
    const a = sim.lastState
    if (!sim.start || sim.closed || !a || sim.play.active) return null
    return computeGhost({
      gas: sim.gas,
      tool: sim.tool,
      a,
      start: sim.start,
      segmentCount: sim.segments.length,
      V: Vx(px),
      P: Py(py),
      px,
      py,
      snapOff,
    })
  }

  function onMove(e: PointerEvent) {
    const p = svgPoint(e)
    const V = Math.max(0, Math.min(VMAX, Vx(p.x)))
    const P = Math.max(0, Math.min(PMAX, Py(p.y)))
    hover = { V, P }
    const r = host.getBoundingClientRect()
    readout = {
      x: e.clientX - r.left,
      y: e.clientY - r.top,
      // Keep the readout inside the pane near its right edge.
      flip: e.clientX - r.left > r.width - 200,
      text: `V ${f1(V)} L · P ${f0(P)} kPa · T ${f0(temperature(sim.gas, P, V))} K`,
    }
    ghost = ghostAt(p.x, p.y, e.shiftKey)
  }

  function onLeave() {
    if (dragging) return
    hover = null
    readout = null
    ghost = null
  }

  function onDown(e: PointerEvent) {
    // Touching the graph leaves playback and goes back to editing.
    if (sim.play.active) sim.stopPlay()
    dragging = true
    svg.setPointerCapture(e.pointerId)
    const p = svgPoint(e)
    ghost = ghostAt(p.x, p.y, e.shiftKey)
  }

  function onUp(e: PointerEvent) {
    dragging = false
    const p = svgPoint(e)
    const outside = p.x < G.L || p.x > G.L + PW || p.y < G.T || p.y > G.T + PH
    if (!sim.start) {
      if (outside) return
      const V = snapV(Vx(p.x), e.shiftKey)
      const P = snapP(Py(p.y), e.shiftKey)
      if (sim.setStart(P, V)) sim.notify('시작 상태 A를 정했어요')
      else sim.notify(`시작 상태는 ${LIMITS.Tmin}~${LIMITS.Tmax} K 안에서 정해 주세요`)
      return
    }
    if (sim.closed) return
    const gh = ghostAt(p.x, p.y, e.shiftKey)
    if (!gh) return
    if (!gh.valid) {
      sim.notify(gh.why || '이 위치로는 그릴 수 없어요')
      return
    }
    sim.addSegment(gh.type, gh.end, gh.closing)
    if (gh.closing) sim.notify('순환이 닫혔어요')
    ghost = null
    if (e.pointerType !== 'mouse') {
      hover = null
      readout = null
    }
  }
</script>

<div class="graph" bind:this={host}>
  <svg
    bind:this={svg}
    viewBox="0 0 {G.W} {G.H}"
    preserveAspectRatio="xMidYMid meet"
    role="application"
    aria-label="압력-부피 그래프"
    onpointermove={onMove}
    onpointerleave={onLeave}
    onpointerdown={onDown}
    onpointerup={onUp}
  >
    <defs>
      <clipPath id="plotclip"><rect x={G.L} y={G.T} width={PW} height={PH} /></clipPath>
    </defs>
    <rect x={G.L} y={G.T} width={PW} height={PH} fill="var(--graph-bg)" />
    {#each vTicks as v (v)}
      <line x1={xV(v)} x2={xV(v)} y1={G.T} y2={G.T + PH} stroke="var(--grid)" stroke-width="1" />
    {/each}
    {#each pTicks as p (p)}
      <line x1={G.L} x2={G.L + PW} y1={yP(p)} y2={yP(p)} stroke="var(--grid)" stroke-width="1" />
    {/each}

    {#if sim.guides}
      <g clip-path="url(#plotclip)">
        {#each isoTemps as T (T)}
          <path
            d={pathD(isothermPts(sim.gas, T))}
            fill="none"
            stroke="var(--guide)"
            stroke-width="1"
            stroke-dasharray="3 4"
          />
        {/each}
        {#if sim.lastState && !sim.closed}
          <path
            d={pathD(adiabatPts(sim.gas, sim.lastState))}
            fill="none"
            stroke="var(--p-adiabatic)"
            stroke-opacity=".35"
            stroke-width="1.2"
            stroke-dasharray="8 5"
          />
        {/if}
      </g>
      {#each isoTemps as T (T)}
        {@const Pe = (sim.gas.n * R * T) / (VMAX - 1.2)}
        {#if Pe < PMAX - 10}
          <text
            x={xV(VMAX) - 4}
            y={yP(Pe) - 4}
            text-anchor="end"
            font-size="10"
            fill="var(--muted)"
            font-family={mono}>{T} K</text
          >
        {/if}
      {/each}
    {/if}

    <line
      x1={G.L}
      x2={G.L + PW}
      y1={G.T + PH}
      y2={G.T + PH}
      stroke="var(--muted)"
      stroke-width="1.2"
    />
    <line x1={G.L} x2={G.L} y1={G.T} y2={G.T + PH} stroke="var(--muted)" stroke-width="1.2" />
    {#each [0, 10, 20, 30, 40, 50] as v (v)}
      <text
        x={xV(v)}
        y={G.T + PH + 16}
        text-anchor="middle"
        font-size="11"
        fill="var(--muted)"
        font-family={mono}>{v}</text
      >
    {/each}
    {#each [0, 100, 200, 300, 400, 500] as p (p)}
      <text
        x={G.L - 8}
        y={yP(p) + 4}
        text-anchor="end"
        font-size="11"
        fill="var(--muted)"
        font-family={mono}>{p}</text
      >
    {/each}
    <text
      x={G.L + PW / 2}
      y={G.H - 8}
      text-anchor="middle"
      font-size="12"
      fill="var(--ink)"
      font-weight="600">부피 V (L)</text
    >
    <text
      transform="translate(16 {G.T + PH / 2}) rotate(-90)"
      text-anchor="middle"
      font-size="12"
      fill="var(--ink)"
      font-weight="600">압력 P (kPa)</text
    >

    {#if cycleArea}
      <path d={cycleArea} fill="var(--accent)" fill-opacity=".14" stroke="none" />
    {/if}

    {#if workArea}
      <path d={workArea.d} fill={workArea.col} fill-opacity=".2" stroke="none" />
    {/if}

    {#each sim.resolved as r, i (r.segment.id)}
      {@const pr = PROC[r.segment.type]}
      <g opacity={cur >= 0 && i > cur ? 0.3 : 1}>
        <path
          d={pathD(segPts(r))}
          fill="none"
          stroke="var({pr.cssVar})"
          stroke-width={i === cur ? 5 : 3}
          stroke-dasharray={pr.dash}
          stroke-linecap="round"
        />
        {#if i === cur}
          <path
            d={pathD(sampleSegment(sim.gas, r.segment.type, r.a, r.b, 0, P.s, 40))}
            fill="none"
            stroke="var({pr.cssVar})"
            stroke-width="7"
            stroke-linecap="round"
            opacity=".35"
          />
        {/if}
        <path d="M-6,-5 L6,0 L-6,5 z" fill="var({pr.cssVar})" transform={arrow(r, 0.55)} />
      </g>
    {/each}

    {#if ghost}
      {@const pr = PROC[ghost.type]}
      {@const col = ghost.valid ? `var(${pr.cssVar})` : 'var(--danger)'}
      <path
        d={pathD(sampleSegment(sim.gas, ghost.type, ghost.a, ghost.b))}
        fill="none"
        stroke={col}
        stroke-width="3"
        stroke-dasharray={pr.dash || '1 0'}
        stroke-linecap="round"
        opacity=".55"
      />
      <circle
        cx={xV(ghost.b.V)}
        cy={yP(ghost.b.P)}
        r="6"
        fill={col}
        fill-opacity=".25"
        stroke={col}
        stroke-width="1.5"
      />
      {#if ghost.closing && sim.start}
        <circle
          cx={xV(sim.start.V)}
          cy={yP(sim.start.P)}
          r="13"
          fill="none"
          stroke="var(--accent)"
          stroke-width="2"
          stroke-dasharray="3 3"
        />
      {/if}
    {/if}

    {#each vertices as v (v.label)}
      <circle
        cx={v.x}
        cy={v.y}
        r="4.5"
        fill="var(--surface)"
        stroke="var(--ink)"
        stroke-width="1.6"
      />
      <text
        x={v.lx}
        y={v.y - 8}
        font-size="13"
        font-weight="700"
        fill="var(--ink)"
        text-anchor={v.anchor}>{v.label}</text
      >
    {/each}

    {#if marker}
      <circle cx={xV(marker.V)} cy={yP(marker.P)} r="11" fill="var(--accent)" fill-opacity=".2" />
      <circle
        cx={xV(marker.V)}
        cy={yP(marker.P)}
        r="6"
        fill="var(--accent)"
        stroke="var(--surface)"
        stroke-width="2"
      />
    {/if}

    {#if hover && !P.playing}
      <line
        x1={xV(hover.V)}
        x2={xV(hover.V)}
        y1={G.T}
        y2={G.T + PH}
        stroke="var(--muted)"
        stroke-opacity=".35"
        stroke-dasharray="2 3"
      />
      <line
        x1={G.L}
        x2={G.L + PW}
        y1={yP(hover.P)}
        y2={yP(hover.P)}
        stroke="var(--muted)"
        stroke-opacity=".35"
        stroke-dasharray="2 3"
      />
    {/if}
  </svg>
  <div class="graph-status" aria-live="polite">{status}</div>
  {#if readout}
    <div class="readout" class:flip={readout.flip} style="left:{readout.x}px;top:{readout.y}px">
      {readout.text}
    </div>
  {/if}
</div>

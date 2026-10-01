<script lang="ts">
  import { tick } from 'svelte'
  import { R, temperature } from '../physics/gas'
  import { LIMITS } from '../physics/path'
  import { stateBetween } from '../physics/processes'
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
    const poly: Pt[] = [...pts, [pts[pts.length - 1][0], G.T + PH], [pts[0][0], G.T + PH]]
    return { d: pathD(poly) + 'z' }
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
      return {
        i,
        x,
        y,
        lx: x + (right ? -10 : 9),
        anchor: right ? 'end' : 'start',
        label: LETTERS[i],
      }
    })
  })

  // Pressing a vertex (or Enter on it) opens one field for the segment's free end value: P₂ for
  // isochoric, V₂ for the others. The process fixes everything else, as before in the table.
  let vedit = $state<{ i: number; x: number; y: number; flip: boolean } | null>(null)
  let overV = $state(false)
  let vpress = -1
  /** Hit radius around a vertex: 22 screen px for a finger, 12 for a mouse, in SVG units. */
  function hitR(coarse: boolean) {
    const k = svg?.getScreenCTM()?.a || 1
    return (coarse ? 22 : 12) / k
  }
  function vertexAt(px: number, py: number, coarse = false) {
    if (P.playing) return -1
    let best = -1
    let bd = hitR(coarse)
    for (const v of vertices) {
      const d = Math.hypot(v.x - px, v.y - py)
      if (v.i > 0 && d < bd) [best, bd] = [v.i, d]
    }
    return best
  }
  /** Large screens draw the app with CSS zoom; positions inside the graph are unzoomed pixels. */
  function zoom() {
    const app = host.closest<HTMLElement>('.app')
    return (app && parseFloat(getComputedStyle(app).zoom)) || 1
  }
  function openEdit(i: number) {
    const v = vertices.find((w) => w.i === i)
    const ctm = svg.getScreenCTM()
    if (!v || !ctm) return
    const r = host.getBoundingClientRect()
    const z = zoom()
    const y = (v.y * ctm.d + ctm.f - r.top) / z
    vedit = { i, x: (v.x * ctm.a + ctm.e - r.left) / z, y, flip: y > r.height / z - 70 }
    ghost = null
    readout = null
    hover = null
    queueMicrotask(() => host.querySelector<HTMLInputElement>('.vedit input')?.select())
  }
  const REFUSED = {
    range: '그 값이면 그래프 범위(0.5–50 L, 5–500 kPa, 50–2500 K)를 벗어나요',
    tiny: '그 값이면 구간이 너무 짧아져요',
    open: '그 값이면 같은 과정으로 A에 돌아올 수 없어요',
  } as const
  function applyEdit(e: Event) {
    if (!vedit) return
    const el = e.currentTarget as HTMLInputElement
    const no = sim.setEnd(vedit.i - 1, Number(el.value))
    if (no) sim.notify(REFUSED[no])
  }
  /** Back to the vertex that was edited, so Tab and Enter carry on from there. */
  async function refocus(i: number) {
    vedit = null
    await tick()
    svg.querySelector<SVGElement>(`.vertex[data-i="${i}"]`)?.focus()
  }
  function editKey(e: KeyboardEvent) {
    e.stopPropagation()
    if (!vedit) return
    if (e.key === 'Enter') {
      applyEdit(e)
      refocus(vedit.i)
    } else if (e.key === 'Escape') refocus(vedit.i)
  }
  function vertexKey(e: KeyboardEvent, i: number) {
    if (e.key !== 'Enter' && e.key !== ' ') return
    e.preventDefault()
    e.stopPropagation()
    openEdit(i)
  }

  // One line of guidance while drawing; during playback the graph and the 3D chips say enough.
  const status = $derived.by(() => {
    if (P.active && P.done)
      return sim.closed ? '한 바퀴 완료 · 파란 영역이 알짜 일이에요' : '재생 완료'
    if (cur >= 0 && !P.playing) {
      const n = sim.resolved.length
      const to = sim.closed && cur === n - 1 ? 'A' : LETTERS[cur + 1]
      return `${LETTERS[cur]}→${to} ${PROC[sim.resolved[cur].segment.type].full} · 일시정지`
    }
    if (cur >= 0 || !sim.start) return ''
    if (sim.closed) return '순환이 닫혔어요 · 실행을 눌러 보세요'
    if (ghost && !ghost.valid) return ghost.why || '범위를 벗어났어요'
    if (ghost?.closing)
      return ghost.adjust != null
        ? '놓으면 앞 상태를 살짝 맞춰 A에 닫아요'
        : '놓으면 A로 돌아와 순환이 닫혀요'
    if (ghost?.far) return farHint(sim.tool, '찍어요')
    if (note) return note
    // A loaded single-process example is complete as it is; drawing on is optional.
    if (sim.preset) return '실행을 눌러 보세요 · 이어서 그려도 돼요'
    const t = PROC[sim.tool]
    return `${t.name}: ${t.plain} · 끌거나 눌러서 다음 상태를 정하세요`
  })

  // A tap ends before its preview can be read, so the reason a point landed off the finger
  // stays in the status line until the next touch.
  let note = $state('')
  const farHint = (tool: string, verb: string) =>
    tool === 'isothermal'
      ? `등온선은 오른쪽으로 갈수록 내려가요(PV 일정) · 선 위의 가장 가까운 점에 ${verb}`
      : `단열선은 등온선보다 가파르게 내려가요 · 선 위의 가장 가까운 점에 ${verb}`

  // Drop a stale preview when the path or tool changes underneath it.
  $effect(() => {
    void sim.tool
    void sim.lastState
    if (!dragging) ghost = null
  })
  // A new tool starts a fresh hint (the path changing must not clear it: placing the point does).
  $effect(() => {
    void sim.tool
    note = ''
  })

  function svgPoint(e: PointerEvent) {
    const pt = svg.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    return pt.matrixTransform(svg.getScreenCTM()!.inverse())
  }
  const svgXY = (e: PointerEvent): [number, number] => {
    const p = svgPoint(e)
    return [p.x, p.y]
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
      path: sim.path,
    })
  }

  function onMove(e: PointerEvent) {
    const p = svgPoint(e)
    overV = vertexAt(p.x, p.y) > 0
    if (vedit || vpress > 0) return
    const V = Math.max(0, Math.min(VMAX, Vx(p.x)))
    const P = Math.max(0, Math.min(PMAX, Py(p.y)))
    hover = { V, P }
    const r = host.getBoundingClientRect()
    const z = zoom()
    readout = {
      x: (e.clientX - r.left) / z,
      y: (e.clientY - r.top) / z,
      // Keep the readout inside the pane near its right edge.
      flip: e.clientX - r.left > r.width - 200 * z,
      text: `V ${f1(V)} L · P ${f0(P)} kPa · T ${f0(temperature(sim.gas, P, V))} K`,
    }
    ghost = ghostAt(p.x, p.y, e.shiftKey)
    if (ghost) readout.text = say(ghost.b.V, ghost.b.P)
  }

  function onLeave() {
    if (dragging) return
    hover = null
    readout = null
    ghost = null
  }

  function onDown(e: PointerEvent) {
    const v = vertexAt(...svgXY(e), e.pointerType !== 'mouse')
    if (v > 0) {
      // No compatibility mouse events: their focus would land on the circle and close the field
      // the tap is about to open.
      e.preventDefault()
      vpress = v
      return
    }
    // On an open path, touching the graph leaves playback and goes back to editing. A closed
    // cycle has nothing left to draw, so a stray touch must not reset its playback.
    if (sim.play.active && !sim.closed) sim.stopPlay()
    note = ''
    dragging = true
    svg.setPointerCapture(e.pointerId)
    const p = svgPoint(e)
    ghost = ghostAt(p.x, p.y, e.shiftKey)
  }

  /** Place a point at plot coordinates (px, py): the start A, or the next segment's end. */
  function commit(px: number, py: number, snapOff: boolean) {
    const outside = px < G.L || px > G.L + PW || py < G.T || py > G.T + PH
    if (!sim.start) {
      if (outside) return
      const V = snapV(Vx(px), snapOff)
      const P = snapP(Py(py), snapOff)
      if (sim.setStart(P, V)) sim.notify('시작 상태 A를 정했어요')
      else sim.notify(`시작 상태는 ${LIMITS.Tmin}~${LIMITS.Tmax} K 안에서 정해 주세요`)
      return
    }
    if (sim.closed) return
    const gh = ghostAt(px, py, snapOff)
    if (!gh) return
    if (!gh.valid) {
      sim.notify(gh.why || '이 위치로는 그릴 수 없어요')
      return
    }
    sim.addSegment(gh.type, gh.end, gh.closing, gh.adjust)
    note = gh.far ? farHint(gh.type, '찍었어요') : ''
    if (gh.closing)
      sim.notify(
        gh.adjust != null
          ? `순환이 닫혔어요 · ${LETTERS[sim.segments.length - 1]} 위치를 살짝 맞춰 A에 붙였어요`
          : '순환이 닫혔어요',
      )
    ghost = null
  }

  function onUp(e: PointerEvent) {
    if (vpress > 0) {
      if (vertexAt(...svgXY(e), e.pointerType !== 'mouse') === vpress) openEdit(vpress)
      vpress = -1
      return
    }
    dragging = false
    const p = svgPoint(e)
    commit(p.x, p.y, e.shiftKey)
    if (e.pointerType !== 'mouse') {
      hover = null
      readout = null
    }
  }

  // Keyboard drawing: arrows move a cursor (Shift for big steps), Enter places the point.
  let kb = $state<{ V: number; P: number } | null>(null)
  const say = (V: number, P: number) =>
    `V ${f1(V)} L · P ${f0(P)} kPa · T ${f0(temperature(sim.gas, P, V))} K`

  function showCursor(V: number, P: number) {
    kb = { V, P }
    hover = { V, P }
    const ctm = svg.getScreenCTM()
    const r = host.getBoundingClientRect()
    if (ctm) {
      const z = zoom()
      const x = (xV(V) * ctm.a + ctm.e - r.left) / z
      const y = (yP(P) * ctm.d + ctm.f - r.top) / z
      readout = { x, y, flip: x > r.width / z - 200, text: say(V, P) }
    }
    ghost = ghostAt(xV(V), yP(P), false)
    if (ghost && readout) readout.text = say(ghost.b.V, ghost.b.P)
  }

  function onBlur() {
    kb = null
    hover = null
    readout = null
    ghost = null
  }

  function onKey(e: KeyboardEvent) {
    const big = e.shiftKey
    const d: Record<string, [number, number]> = {
      ArrowRight: [big ? 5 : 0.5, 0],
      ArrowLeft: [big ? -5 : -0.5, 0],
      ArrowUp: [0, big ? 50 : 5],
      ArrowDown: [0, big ? -50 : -5],
    }
    if (d[e.key]) {
      e.preventDefault()
      e.stopPropagation()
      if (sim.play.active && !sim.closed) sim.stopPlay()
      const c = kb ?? { V: sim.lastState?.V ?? 20, P: sim.lastState?.P ?? 200 }
      const V = Math.max(0.5, Math.min(VMAX, snapV(c.V + d[e.key][0])))
      const P = Math.max(5, Math.min(PMAX, snapP(c.P + d[e.key][1])))
      showCursor(V, P)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      e.stopPropagation()
      // Enter before any arrow press places the point where the cursor would first appear.
      if (!kb) showCursor(sim.lastState?.V ?? 20, sim.lastState?.P ?? 200)
      if (!kb) return
      commit(xV(kb.V), yP(kb.P), false)
      // Keep the cursor where the new point landed so drawing continues from there.
      const a = sim.lastState
      if (a) showCursor(a.V, a.P)
    }
  }
</script>

<div class="graph" bind:this={host}>
  <!-- role="application" is a keyboard-operable drawing surface (arrows + Enter, see onKey). -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
  <svg
    bind:this={svg}
    viewBox="0 0 {G.W} {G.H}"
    preserveAspectRatio="xMidYMid meet"
    role="application"
    aria-label="압력-부피 그래프"
    aria-describedby="graph-keys graph-live"
    tabindex="0"
    onblur={onBlur}
    onkeydown={onKey}
    onpointermove={onMove}
    onpointerleave={onLeave}
    onpointerdown={onDown}
    onpointerup={onUp}
    style:cursor={overV ? 'pointer' : null}
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
      {#each isoTemps.filter((_, i) => i % 2 === 1) as T (T)}
        {@const Pe = (sim.gas.n * R * T) / (VMAX - 1.2)}
        {#if Pe < PMAX - 10}
          <text
            x={xV(VMAX) - 4}
            y={yP(Pe) - 4}
            text-anchor="end"
            font-size="12"
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
        font-size="12"
        fill="var(--muted)"
        font-family={mono}>{v}</text
      >
    {/each}
    {#each [0, 100, 200, 300, 400, 500] as p (p)}
      <text
        x={G.L - 8}
        y={yP(p) + 4}
        text-anchor="end"
        font-size="12"
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
      <path d={workArea.d} fill="var(--ink)" fill-opacity=".08" stroke="none" />
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

    {#if ghost?.prev}
      {@const pp = PROC[ghost.prev.type]}
      <path
        d={pathD(sampleSegment(sim.gas, ghost.prev.type, ghost.prev.a, ghost.prev.b))}
        fill="none"
        stroke="var({pp.cssVar})"
        stroke-width="3"
        stroke-dasharray={pp.dash || '1 0'}
        stroke-linecap="round"
        opacity=".55"
      />
      <circle
        cx={xV(ghost.prev.b.V)}
        cy={yP(ghost.prev.b.P)}
        r="5"
        fill="var(--accent)"
        fill-opacity=".3"
        stroke="var(--accent)"
        stroke-width="1.5"
      />
    {/if}
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
      {#if v.i > 0 && !P.playing}
        <!-- A vertex after A is a button: it opens the field for that segment's end value. -->
        <g
          class="vertex"
          data-i={v.i}
          role="button"
          tabindex="0"
          aria-label="{v.label} 값 바꾸기"
          onkeydown={(e) => vertexKey(e, v.i)}
          ><circle class="vhit" cx={v.x} cy={v.y} r="14" fill="transparent" /><circle
            class="vdot"
            cx={v.x}
            cy={v.y}
            r="5.5"
            fill="var(--ink)"
            stroke="var(--surface)"
            stroke-width="2"
          /></g
        >
      {:else}
        <circle
          cx={v.x}
          cy={v.y}
          r="4.5"
          fill="var(--surface)"
          stroke="var(--ink)"
          stroke-width="1.6"
        />
      {/if}
      <text
        x={v.lx}
        y={v.y - 8}
        font-size="14"
        font-weight="700"
        fill="var(--ink)"
        text-anchor={v.anchor}>{v.label}</text
      >
    {/each}

    {#if marker}
      <circle cx={xV(marker.V)} cy={yP(marker.P)} r="13" fill="var(--ink)" fill-opacity=".16" />
      <circle
        cx={xV(marker.V)}
        cy={yP(marker.P)}
        r="7"
        fill="var(--ink)"
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
        pointer-events="none"
      />
      <line
        x1={G.L}
        x2={G.L + PW}
        y1={yP(hover.P)}
        y2={yP(hover.P)}
        stroke="var(--muted)"
        stroke-opacity=".35"
        stroke-dasharray="2 3"
        pointer-events="none"
      />
    {/if}
  </svg>
  {#if status}<div class="graph-status" aria-live="polite">{status}</div>{/if}
  {#if !sim.start}
    <div class="graph-empty">
      <p>그래프를 눌러 기체의 처음 상태 A를 찍으세요</p>
    </div>
  {/if}
  <span class="sr-only" id="graph-keys"
    >방향키로 옮기고 Enter로 점을 찍어요. Shift는 큰 걸음이에요.</span
  >
  <span class="sr-only" id="graph-live" aria-live="polite">{kb ? say(kb.V, kb.P) : ''}</span>
  {#if vedit && sim.resolved[vedit.i - 1]}
    {@const r = sim.resolved[vedit.i - 1]}
    {@const iso = r.segment.type === 'isochoric'}
    <label class="vedit" class:flip={vedit.flip} style="left:{vedit.x}px;top:{vedit.y}px">
      {LETTERS[vedit.i]}
      {iso ? 'P (kPa)' : 'V (L)'}
      <input
        type="number"
        step={iso ? 5 : 0.5}
        value={iso ? f0(r.b.P) : f1(r.b.V)}
        onchange={applyEdit}
        onkeydown={editKey}
        onblur={() => (vedit = null)}
      />
    </label>
  {/if}
  {#if readout}
    <div class="readout" class:flip={readout.flip} style="left:{readout.x}px;top:{readout.y}px">
      {readout.text}
    </div>
  {/if}
</div>

<script lang="ts">
  import { LETTERS, PROC, WHY } from '../i18n/ko'
  import { sim } from '../store/simulation.svelte'

  const v = $derived(sim.view)
  const steps = $derived.by(() => {
    if (v.empty || !sim.resolved.length) return null
    const w = WHY[v.type]
    if (Array.isArray(w)) return w
    return v.vdir > 0 ? w.expand : v.vdir < 0 ? w.compress : null
  })

  /** "A→B" while a playhead is on a segment. */
  const span = $derived.by(() => {
    if (!v.live) return ''
    const n = sim.resolved.length
    const i = Math.min(sim.play.seg, n - 1)
    return `${LETTERS[i]}→${sim.closed && i === n - 1 ? 'A' : LETTERS[i + 1]}`
  })

  const where = (side: 'hot' | 'cold') =>
    side === 'hot'
      ? sim.fridge
        ? '고온부(실외)'
        : '고온 열원'
      : sim.fridge
        ? '저온부(실내)'
        : '저온 열원'
  // Which way heat goes on this segment: the sign of its whole Q, so pausing or scrubbing keeps it.
  const heat = $derived.by(() => {
    if (!v.live) return ''
    if (v.type === 'adiabatic') return '단열: 열 출입 없음'
    if (!v.heat || !v.side) return '열 출입 없음'
    const w = where(v.side)
    return v.heat > 0 ? `${w} → 기체: 열 받음` : `기체 → ${w}: 열 잃음`
  })
</script>

<div class="why" aria-live="polite">
  <div class="why-head">
    {#if steps}
      <b class="why-proc"
        ><span class="dot" style="background:var({PROC[v.type].cssVar})"></span>{#if span}<span
            class="num">{span}</span
          >{/if}<span>{PROC[v.type].full}</span></b
      >
      {#if heat}<span class="why-heat">{heat}</span>{/if}
    {:else}
      <b>왜 이렇게 움직일까?</b>
    {/if}
  </div>
  {#if steps}
    <ol>
      {#each steps as x (x)}<li><span>{x}</span></li>{/each}
    </ol>
  {:else}
    <p class="why-empty">경로를 그리면 피스톤이 움직이는 이유를 단계별로 보여줘요.</p>
  {/if}
</div>

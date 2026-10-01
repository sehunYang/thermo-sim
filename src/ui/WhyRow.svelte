<script lang="ts">
  import { PROC, WHY } from '../i18n/ko'
  import { sim } from '../store/simulation.svelte'

  let open = $state(true)

  const steps = $derived.by(() => {
    const v = sim.view
    if (!v.live) return null
    const w = WHY[v.type]
    if (Array.isArray(w)) return w
    const mv = v.moving ? v.vdir : 0
    return mv > 0 ? w.expand : mv < 0 ? w.compress : null
  })
  const sub = $derived.by(() => {
    const v = sim.view
    if (!steps) return '재생하면 지금 과정에서 피스톤이 움직이는 이유를 단계별로 보여줘요.'
    return `${PROC[v.type].full}${v.type === 'isochoric' ? '' : v.vdir > 0 ? ' · 팽창' : ' · 압축'}`
  })
</script>

<div class="why" aria-live="polite">
  <div class="why-head">
    <b>왜 이렇게 움직일까?</b><span class="sub">{sub}</span>
    <button class="why-tog" aria-expanded={open} onclick={() => (open = !open)}
      >{open ? '접기' : '펼치기'}</button
    >
  </div>
  {#if steps && open}
    <ol>
      {#each steps as x (x)}<li><span>{x}</span></li>{/each}
    </ol>
    <div class="why-legend">
      <span>U자관: 은색 수은이 내려간 쪽의 압력이 더 커요</span><span
        >Δh = 두 압력의 차이 (보이도록 과장)</span
      >
    </div>
  {/if}
</div>

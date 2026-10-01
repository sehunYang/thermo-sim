<script lang="ts">
  import { WHY } from '../i18n/ko'
  import { sim } from '../store/simulation.svelte'

  let open = $state(true)

  const steps = $derived.by(() => {
    const v = sim.view
    if (v.empty || !sim.resolved.length) return null
    const w = WHY[v.type]
    if (Array.isArray(w)) return w
    return v.vdir > 0 ? w.expand : v.vdir < 0 ? w.compress : null
  })
</script>

<div class="why" aria-live="polite">
  <div class="why-head">
    <b>왜 이렇게 움직일까?</b>
    <button class="why-tog" aria-expanded={open} onclick={() => (open = !open)}
      >{open ? '접기' : '펼치기'}</button
    >
  </div>
  {#if open}
    {#if steps}
      <ol>
        {#each steps as x (x)}<li><span>{x}</span></li>{/each}
      </ol>
    {:else}
      <p class="why-empty">경로를 그리면 피스톤이 움직이는 이유를 단계별로 보여줘요.</p>
    {/if}
    <p class="why-legend">
      U자관: 더 세게 미는 쪽의 수은이 내려가요. 높이 차 Δh는 잘 보이게 크게 그렸어요.
    </p>
  {/if}
</div>

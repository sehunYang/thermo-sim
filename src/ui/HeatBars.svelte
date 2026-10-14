<script lang="ts">
  import { f0 } from '../i18n/ko'
  import { heatSoFar } from '../physics/timeline'
  import { sim } from '../store/simulation.svelte'

  // A closed cycle's heat in and out, known before it runs: the faint track is the cycle's total,
  // the fill is what has flowed so far in this loop (it starts over each time the loop restarts).
  const totals = $derived.by(() => {
    if (!sim.closed || !sim.resolved.length) return null
    const n = sim.resolved.length
    return heatSoFar(sim.gas, sim.resolved, n - 1, 1)
  })
  const now = $derived(
    totals && sim.play.active
      ? heatSoFar(sim.gas, sim.resolved, sim.play.seg, sim.play.s)
      : { qin: 0, qout: 0 },
  )
  // Both bars share one scale, so the gap between them is the net work of the cycle.
  const scale = $derived(totals ? Math.max(1e-9, totals.qin, totals.qout) : 1)
  const rows = $derived(
    totals
      ? [
          { label: '받은 열', total: totals.qin, now: now.qin },
          { label: '잃은 열', total: totals.qout, now: now.qout },
        ]
      : [],
  )
</script>

{#if totals}
  <div class="heatbars" role="group" aria-label="이번 순환에서 오간 열">
    {#each rows as r (r.label)}
      <div class="hb-row">
        <span class="hb-label">{r.label}</span>
        <span class="hb-track" style:width="{(r.total / scale) * 100}%">
          <i style:width="{r.total > 0 ? Math.min(100, (r.now / r.total) * 100) : 0}%"></i>
        </span>
        <span class="hb-val num">{f0(r.now)}<small>&nbsp;/ {f0(r.total)} J</small></span>
      </div>
    {/each}
  </div>
{/if}

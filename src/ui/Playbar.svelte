<script lang="ts">
  import { LETTERS } from '../i18n/ko'
  import { sim } from '../store/simulation.svelte'

  const SPEEDS = [0.25, 0.5, 1, 2, 4]
  const n = $derived(sim.resolved.length)
  const P = $derived(sim.play)
  const label = $derived(P.playing ? '일시정지' : '실행')
  const ticks = $derived(
    n
      ? Array.from({ length: n + 1 }, (_, i) => ({
          left: (i / n) * 100,
          label: sim.closed && i === n ? 'A' : LETTERS[i],
        }))
      : [],
  )
</script>

<div class="playbar" class:stick={sim.closed || P.active}>
  <button class="btn icon" title="처음으로" aria-label="처음으로" onclick={() => sim.rewind()}>
    <svg width="16" height="16" viewBox="0 0 16 16"
      ><path
        d="M4 3v10M13 3.5L6.5 8 13 12.5z"
        fill="currentColor"
        stroke="currentColor"
        stroke-width="1.2"
        stroke-linejoin="round"
      /></svg
    >
  </button>
  <button class="run" disabled={!n} onclick={() => sim.togglePlay()}>
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      {#if P.playing}
        <rect x="2.5" y="1.5" width="3" height="11" fill="currentColor" /><rect
          x="8.5"
          y="1.5"
          width="3"
          height="11"
          fill="currentColor"
        />
      {:else}
        <path d="M3 1.5v11l9-5.5z" fill="currentColor" />
      {/if}
    </svg>
    <span>{label}</span>
  </button>
  <button
    class="btn icon"
    title="다음 구간"
    aria-label="다음 구간"
    onclick={() => sim.nextSegment()}
  >
    <svg width="16" height="16" viewBox="0 0 16 16"
      ><path
        d="M12 3v10M3 3.5L9.5 8 3 12.5z"
        fill="currentColor"
        stroke="currentColor"
        stroke-width="1.2"
        stroke-linejoin="round"
      /></svg
    >
  </button>
  <div class="scrub">
    <div class="scrub-ticks">
      {#each ticks as t (t.left)}<span style="left:{t.left}%">{t.label}</span>{/each}
    </div>
    <input
      type="range"
      min="0"
      max="1000"
      value={Math.round(sim.progress * 1000)}
      aria-label="재생 위치"
      oninput={(e) => sim.seek(Number(e.currentTarget.value) / 1000)}
    />
  </div>
  <!-- The button names its own speed; each press steps to the next one. -->
  <button
    class="btn speed"
    aria-label="재생 속도"
    title="재생 속도 바꾸기"
    onclick={() => (sim.play.speed = SPEEDS[(SPEEDS.indexOf(P.speed) + 1) % SPEEDS.length] ?? 1)}
    ><span class="num">{P.speed}×</span></button
  >
</div>

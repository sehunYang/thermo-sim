<script lang="ts">
  import { LETTERS, PROC, PROCESS_TYPES } from '../i18n/ko'
  import { sim } from '../store/simulation.svelte'
  import Swatch from './Swatch.svelte'

  function complete() {
    const n = sim.segments.length
    const c = sim.autoComplete()
    if (!c) {
      sim.notify('지금 상태에서는 A로 돌아갈 과정을 찾지 못했어요')
      return
    }
    const names = c.add.map((s) => PROC[s.type].full).join(' → ')
    sim.notify(
      c.adjust != null
        ? `${names}으로 A에 닫았어요 · ${LETTERS[n]}를 살짝 옮겼어요`
        : `${names}으로 A에 닫았어요`,
    )
  }
</script>

<div class="tools" role="toolbar" aria-label="과정 도구">
  {#each PROCESS_TYPES as t (t)}
    {@const pr = PROC[t]}
    <button
      class="tool"
      aria-pressed={sim.tool === t}
      style="--tc:var({pr.cssVar})"
      title="{pr.full} ({pr.law})"
      onclick={() => (sim.tool = t)}
    >
      <Swatch type={t} />{pr.name}<kbd>{pr.key}</kbd>
    </button>
  {/each}
  <span class="sep"></span>
  <span class="tool-actions">
    <button
      class="btn icon"
      title="되돌리기 (Ctrl+Z)"
      aria-label="되돌리기"
      disabled={!sim.canUndo}
      onclick={() => sim.undo()}
    >
      <svg width="16" height="16" viewBox="0 0 16 16"
        ><path
          d="M5 4L2 7l3 3M2.5 7H10a3.5 3.5 0 010 7H7"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        /></svg
      >
    </button>
    <button
      class="btn icon"
      title="다시 (Ctrl+Y)"
      aria-label="다시"
      disabled={!sim.canRedo}
      onclick={() => sim.redo()}
    >
      <svg width="16" height="16" viewBox="0 0 16 16"
        ><path
          d="M11 4l3 3-3 3M13.5 7H6a3.5 3.5 0 000 7h3"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        /></svg
      >
    </button>
    <button
      class="btn"
      title="마지막 상태에서 A로 돌아가는 가장 가까운 과정을 찾아 순환을 닫아요"
      disabled={!sim.segments.length || sim.closed}
      onclick={complete}>자동 완성</button
    >
    <button class="btn" disabled={!sim.start} onclick={() => sim.clear()}>지우기</button>
  </span>
</div>

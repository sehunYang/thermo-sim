<script lang="ts">
  import { LETTERS, PROC, PROCESS_TYPES } from '../i18n/ko'
  import { sim } from '../store/simulation.svelte'
  import Swatch from './Swatch.svelte'

  function complete() {
    const n = sim.segments.length
    const last = sim.resolved.at(-1)
    const c = sim.autoComplete()
    if (!c || !last) {
      sim.notify('지금 상태에서는 A로 돌아갈 과정을 찾지 못했어요')
      return
    }
    // Say exactly what changed: a nudge is "살짝", anything larger is named, with the way back.
    const names = c.add.map((s) => PROC[s.type].full).join(' → ')
    const seg = `${LETTERS[n - 1]}→${LETTERS[n]}`
    const iso = last.segment.type === 'isochoric'
    const was = (up: boolean) => (iso ? (up ? '가열' : '냉각') : up ? '팽창' : '압축')
    const up = last.segment.end > (iso ? last.a.P : last.a.V)
    const L = LETTERS[n]
    const to = (w: string) => (w === '가열' ? '가열로' : `${w}으로`)
    let msg =
      c.change === 'flip'
        ? `${seg}를 ${was(up)}에서 ${to(was(!up))} 바꾸고 ${names}으로 A에 닫았어요`
        : c.change === 'big'
          ? `${seg}의 끝 ${L}를 크게 옮기고 ${names}으로 A에 닫았어요`
          : `${names}으로 A에 닫았어요`
    if (c.change === 'small') msg += ` · ${L}를 살짝 옮겼어요`
    if (c.overlap) msg += ' · 앞의 선과 겹쳐요'
    if (c.change === 'flip' || c.change === 'big') msg += ' · 되돌리기로 돌아갈 수 있어요'
    sim.notify(msg)
  }
</script>

<div class="tools" role="toolbar" aria-label="과정 도구">
  {#each PROCESS_TYPES as t (t)}
    {@const pr = PROC[t]}
    <button
      class="tool"
      aria-pressed={sim.tool === t && !sim.closed}
      style="--tc:var({pr.cssVar})"
      title="{pr.full}: {pr.plain} ({pr.law}) · 단축키 {pr.key}"
      onclick={() => (sim.tool = t)}
    >
      <Swatch type={t} />{pr.name}
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

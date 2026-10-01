<script lang="ts">
  import { sim } from '../store/simulation.svelte'

  const STEPS = [
    {
      t: '그래프에 그려요',
      p: '그래프를 누르면 그 압력과 부피가 처음 상태 A가 돼요(온도는 PV = nRT). 위에서 과정을 고르고 이어서 누르면 선은 그 과정의 곡선 위로만 그려지고, A로 돌아오면 순환이 닫혀요.',
      el: '.graph-pane',
    },
    {
      t: '실행해서 비교해요',
      p: '실행을 누르면 열기관의 피스톤, 입자, 열 흐름이 그래프의 점과 함께 움직여요. 아래 표에서 Q = ΔU + W를 확인하세요.',
      el: '.playbar',
    },
  ]

  const CARD_W = 360
  const CARD_H = 210
  const GAP = 12

  let next: HTMLButtonElement | undefined = $state()
  let place = $state('')
  // Opened from a shared link, the graph already holds a path: explain it instead of asking for A.
  const READ_PATH = {
    t: '그래프가 기체의 상태예요',
    p: '점 하나는 그 순간 기체의 압력과 부피이고, 선은 기체가 거쳐 가는 과정이에요. 처음 상태가 A예요. 지우기를 누르면 직접 그릴 수 있어요.',
    el: '.graph',
  }
  const step = $derived(
    !sim.coach ? null : sim.coach === 1 && sim.start ? READ_PATH : STEPS[sim.coach - 1],
  )

  /** Put the card in the largest free space around the target so it never covers it. */
  function placeCard(rect: DOMRect) {
    // On large screens the app is drawn with CSS zoom; fixed offsets inside it are scaled too,
    // so work in the app's own (unzoomed) pixels.
    const app = document.querySelector<HTMLElement>('.app')
    const z = (app && parseFloat(getComputedStyle(app).zoom)) || 1
    const r = {
      left: rect.left / z,
      right: rect.right / z,
      top: rect.top / z,
      bottom: rect.bottom / z,
      width: rect.width / z,
    }
    const W = innerWidth / z
    const H = innerHeight / z
    const w = Math.min(CARD_W, W - 32)
    const cx = Math.max(16, Math.min(W - w - 16, r.left + r.width / 2 - w / 2))
    const cy = Math.max(16, Math.min(H - CARD_H - 16, r.top))
    if (H - r.bottom >= CARD_H + GAP) return `left:${cx}px;top:${r.bottom + GAP}px`
    if (r.top >= CARD_H + GAP) return `left:${cx}px;bottom:${H - r.top + GAP}px`
    if (W - r.right >= w + GAP) return `left:${r.right + GAP}px;top:${cy}px`
    if (r.left >= w + GAP) return `left:${r.left - w - GAP}px;top:${cy}px`
    return `left:${cx}px;bottom:16px`
  }

  // Outline the part of the screen the step talks about, bring it into view, and move focus into
  // the card.
  $effect(() => {
    if (!step) return
    const tgt = document.querySelector<HTMLElement>(step.el)
    tgt?.classList.add('coach-target')
    tgt?.scrollIntoView({ block: 'nearest' })
    if (tgt) place = placeCard(tgt.getBoundingClientRect())
    next?.focus()
    return () => tgt?.classList.remove('coach-target')
  })

  /** A keyboard finish leaves focus on the graph, where the first step begins; a pointer finish
   * leaves nothing ringed, since the hand is already on its way to the graph. */
  function close(e?: Event) {
    sim.coach = 0
    if (e instanceof MouseEvent && e.detail > 0) (document.activeElement as HTMLElement)?.blur()
    else document.querySelector<SVGElement>('.graph svg')?.focus()
  }
  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') close()
  }
</script>

{#if step}
  <div
    class="coach"
    role="presentation"
    onkeydown={onKey}
    onclick={(e) => e.target === e.currentTarget && close(e)}
  >
    <div
      class="coach-card"
      style={place}
      role="dialog"
      aria-modal="true"
      aria-label="사용 안내"
      tabindex="-1"
    >
      <div class="coach-step">{sim.coach} / {STEPS.length}</div>
      <h4>{step.t}</h4>
      <p>{step.p}</p>
      <div class="coach-foot">
        <div class="dots">
          {#each STEPS as s, i (s.t)}<i class:on={i === sim.coach - 1}></i>{/each}
        </div>
        <div style="display:flex;gap:6px">
          <button class="btn" onclick={close}>건너뛰기</button>
          <button
            class="run"
            bind:this={next}
            style="min-height:34px;padding:6px 14px"
            onclick={(e) => (sim.coach < STEPS.length ? sim.coach++ : close(e))}
            >{sim.coach < STEPS.length ? '다음' : '시작하기'}</button
          >
        </div>
      </div>
    </div>
  </div>
{/if}

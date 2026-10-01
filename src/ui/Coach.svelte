<script lang="ts">
  import { sim } from '../store/simulation.svelte'

  const STEPS = [
    {
      t: '시작 상태를 찍어요',
      p: '그래프의 아무 곳이나 누르면 그 압력과 부피가 기체의 처음 상태 A가 돼요. 온도는 PV = nRT로 저절로 정해져요.',
      el: '.graph',
    },
    {
      t: '과정을 골라 그려요',
      p: '등적·등압·등온·단열 중 하나를 고르고 그래프를 끌어 보세요. 선은 그 과정이 허락하는 곡선 위로만 움직여요. A 가까이 돌아오면 순환이 닫혀요.',
      el: '.tools',
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
  const step = $derived(sim.coach ? STEPS[sim.coach - 1] : null)

  /** Put the card in the largest free space around the target so it never covers it. */
  function placeCard(r: DOMRect) {
    const W = innerWidth
    const H = innerHeight
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

  function close() {
    sim.coach = 0
    // Leave the keyboard where the first step begins.
    document.querySelector<SVGElement>('.graph svg')?.focus()
  }
  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') close()
  }
</script>

{#if step}
  <div
    class="coach"
    role="dialog"
    aria-modal="true"
    aria-label="사용 안내"
    tabindex="-1"
    onkeydown={onKey}
  >
    <div class="coach-card" style={place}>
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
            onclick={() => (sim.coach < STEPS.length ? sim.coach++ : close())}
            >{sim.coach < STEPS.length ? '다음' : '시작하기'}</button
          >
        </div>
      </div>
    </div>
  </div>
{/if}

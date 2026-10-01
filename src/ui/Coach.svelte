<script lang="ts">
  import { sim } from '../store/simulation.svelte'

  const STEPS = [
    {
      t: '시작 상태를 찍어요',
      p: '왼쪽 그래프의 아무 곳이나 누르면 그 압력과 부피가 기체의 처음 상태 A가 됩니다. 온도는 PV = nRT로 자동 계산돼요.',
      el: '.graph',
    },
    {
      t: '과정을 골라 그려요',
      p: '등적·등압·등온·단열 중 하나를 고르고 끌어 보세요. 선은 그 과정이 허락하는 곡선 위로만 움직여요. A 근처로 돌아오면 순환이 닫혀요.',
      el: '.tools',
    },
    {
      t: '실행해서 비교해요',
      p: '실행을 누르면 오른쪽 열기관의 피스톤, 입자, 열 흐름이 그래프의 점과 함께 움직여요. 아래 표에서 Q = ΔU + W를 확인하세요.',
      el: '.playbar',
    },
  ]

  let next: HTMLButtonElement | undefined = $state()
  const step = $derived(sim.coach ? STEPS[sim.coach - 1] : null)

  // Outline the part of the screen the step talks about, and move focus into the card.
  $effect(() => {
    if (!step) return
    const tgt = document.querySelector(step.el)
    tgt?.classList.add('coach-target')
    next?.focus()
    return () => tgt?.classList.remove('coach-target')
  })

  function close() {
    sim.coach = 0
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
    <div class="coach-card">
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
            onclick={() => (sim.coach = sim.coach < STEPS.length ? sim.coach + 1 : 0)}
            >{sim.coach < STEPS.length ? '다음' : '시작하기'}</button
          >
        </div>
      </div>
    </div>
  </div>
{/if}

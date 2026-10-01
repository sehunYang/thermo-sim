<script lang="ts">
  import { PROC, PROCESS_TYPES } from '../i18n/ko'
  import { sim } from '../store/simulation.svelte'

  const TABS = [
    ['start', '처음 사용법'],
    ['terms', '용어와 부호'],
  ] as const

  // Every symbol the screen shows, each with one plain line.
  const TERMS: [string, string][] = [
    ['P · kPa', '압력. 기체가 벽을 미는 세기예요. 대기압은 약 101 kPa예요.'],
    ['V · L', '부피. 1 L는 우유 팩 하나만큼이에요.'],
    ['T · K', '절대온도. 0 °C가 273 K예요. 입자가 빠를수록 높아요.'],
    ['Q', '기체가 받은 열. +면 열을 받고, −면 열을 잃어요.'],
    ['W', '기체가 한 일. +면 기체가 피스톤을 밀어내고(팽창), −면 피스톤에 눌려요(압축).'],
    ['ΔU', '내부 에너지 변화. 입자들의 운동 에너지가 늘면 +, 온도도 함께 올라가요.'],
    [
      '열과 온도',
      '열은 옮겨 가는 에너지, 온도는 입자가 얼마나 빠른지예요. 열을 받아도 온도가 그대로일 수 있어요(등온).',
    ],
    ['Q = ΔU + W', '받은 열은 기체를 데우거나(ΔU) 일을 하는 데(W) 나뉘어 쓰여요.'],
    [
      'γ',
      'γ = C_p / C_v. 압력이 일정할 때와 부피가 일정할 때 1 K 올리는 데 드는 열의 비예요. 클수록 단열선이 가팔라요. 단원자(헬륨처럼 원자 하나) 5/3, 이원자(공기처럼 원자 둘) 7/5.',
    ],
    ['η', '열효율. 받은 열 중 일로 바뀐 몫이에요. η = W_net / Q_in'],
    ['η_C · COP_C', '카르노 한계. 같은 두 온도 사이에서 어떤 기관도 넘을 수 없는 값이에요.'],
    ['COP', '성능계수. 냉방기가 일 1 J로 실내에서 빼낸 열이에요. 1보다 클 수 있어요.'],
    ['W_net · Q_in · Q_out', '한 바퀴 동안의 알짜 일, 받은 열, 잃은 열.'],
    ['W_in · Q_C · Q_H', '냉방기가 받은 일, 실내에서 뺀 열, 실외로 버린 열.'],
    ['U자관', '더 세게 미는 쪽의 수은이 내려가요. 높이 차 Δh는 잘 보이게 크게 그렸어요.'],
    ['입자 색', '느린 입자는 파랑, 빠른 입자는 빨강이에요.'],
  ]

  let dlg: HTMLDivElement | undefined = $state()
  let opener: HTMLElement | null = null
  const open = $derived(!!sim.help)
  $effect(() => {
    if (!open) return
    opener = document.activeElement as HTMLElement | null
    dlg?.querySelector<HTMLElement>('[aria-selected="true"]')?.focus()
    return () => opener?.focus()
  })

  function close() {
    sim.help = ''
  }
  // Esc closes even if focus has somehow left the dialog.
  function onWinKey(e: KeyboardEvent) {
    if (sim.help && e.key === 'Escape') close()
  }
  // Keep Tab inside the dialog.
  function trap(e: KeyboardEvent) {
    const els = [
      ...(dlg?.querySelectorAll<HTMLElement>('button:not([tabindex="-1"]), [tabindex="0"]') ?? []),
    ]
    if (!els.length) return
    const first = els[0]
    const last = els[els.length - 1]
    const at = document.activeElement
    if (e.shiftKey && (at === first || !dlg?.contains(at))) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && (at === last || !dlg?.contains(at))) {
      e.preventDefault()
      first.focus()
    }
  }
  function tour() {
    // The guide takes focus itself; don't pull it back to the help button.
    opener = null
    sim.help = ''
    sim.coach = 1
  }
  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.stopPropagation()
      close()
    } else if (e.key === 'Tab') trap(e)
    else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      if (!(e.target as HTMLElement).matches('[role="tab"]')) return
      e.preventDefault()
      e.stopPropagation()
      sim.help = sim.help === 'start' ? 'terms' : 'start'
      dlg?.querySelector<HTMLElement>(`#help-${sim.help}`)?.focus()
    }
  }
</script>

<!-- "W_in" in the list is written W with a subscript, as the panel shows it. -->
{#snippet subs(text: string)}
  {#each text.split(/_(\w+)/) as part, i (i)}{#if i % 2}<sub>{part}</sub>{:else}{part}{/if}{/each}
{/snippet}

<svelte:window onkeydown={onWinKey} />

{#if sim.help}
  <div
    class="help-back"
    role="presentation"
    onclick={(e) => e.target === e.currentTarget && close()}
  >
    <div
      class="help"
      role="dialog"
      aria-modal="true"
      aria-label="도움말"
      tabindex="-1"
      bind:this={dlg}
      onkeydown={onKey}
    >
      <div class="help-head">
        <div class="tabs" role="tablist">
          {#each TABS as [id, label] (id)}
            <button
              class="tab"
              role="tab"
              id="help-{id}"
              aria-selected={sim.help === id}
              tabindex={sim.help === id ? 0 : -1}
              onclick={() => (sim.help = id)}>{label}</button
            >
          {/each}
        </div>
        <button class="btn icon" aria-label="닫기" onclick={close}>✕</button>
      </div>
      <div class="help-body" role="tabpanel" aria-labelledby="help-{sim.help}">
        {#if sim.help === 'start'}
          <ol>
            <li>그래프를 눌러 기체의 처음 상태 A를 찍어요.</li>
            <li>과정을 골라 그래프를 끌거나 눌러요. A로 돌아오면 순환이 닫혀요.</li>
            <li>실행을 눌러 열기관과 표를 함께 봐요.</li>
            <li>꼭짓점(B, C, …)을 누르면 그 점의 값을 숫자로 고칠 수 있어요.</li>
          </ol>
          <p class="hint-muted">
            키보드: 그래프에서 방향키로 옮기고 Enter로 찍어요. Shift는 큰 걸음, 1~4는 과정, Space는
            실행이에요.
          </p>
          <button class="btn" onclick={tour}>화면에서 따라 하기</button>
        {:else}
          <dl class="terms">
            {#each PROCESS_TYPES as t (t)}
              <div>
                <dt>{PROC[t].name}</dt>
                <dd>{PROC[t].plain}</dd>
              </div>
            {/each}
            {#each TERMS as [k, d] (k)}
              <div>
                <dt class="num">{@render subs(k)}</dt>
                <dd>{@render subs(d)}</dd>
              </div>
            {/each}
          </dl>
        {/if}
      </div>
    </div>
  </div>
{/if}

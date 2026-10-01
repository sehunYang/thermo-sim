<script lang="ts">
  import { LETTERS, PRESET_NOTE, PROC, f0, f1, fmtE } from '../i18n/ko'
  import { sim, type PanelTab } from '../store/simulation.svelte'
  import Swatch from './Swatch.svelte'
  import { energy } from '../physics/processes'
  import { stateAt } from '../physics/path'

  const tabs: [PanelTab, string][] = [
    ['table', '구간과 에너지'],
    ['law', '제1법칙'],
    ['cycle', '순환 분석'],
  ]

  const n = $derived(sim.resolved.length)
  const toLabel = (i: number) => (sim.closed && i === n - 1 ? 'A' : LETTERS[i + 1])
  const note = $derived(sim.preset ? ' ' + PRESET_NOTE[sim.preset] : '')
  /** Sign in words, so the table never relies on colour (0.5 J: a closing segment's rounding). */
  const say = (v: number, pos: string, neg: string) => (v > 0.5 ? pos : v < -0.5 ? neg : '없음')
  const pct = (x: number) => `${(x * 100).toFixed(1)}%`

  function onEnd(i: number, e: Event) {
    const v = Number((e.currentTarget as HTMLInputElement).value)
    if (!sim.setEnd(i, v)) {
      sim.notify('그 값이면 뒤 구간이 범위를 벗어나요')
      // Put the field back to the stored value.
      const r = sim.resolved[i]
      ;(e.currentTarget as HTMLInputElement).value =
        r.segment.type === 'isochoric' ? f0(r.b.P) : f1(r.b.V)
    }
  }

  // The law tab follows the playhead; without one it shows the first segment in full.
  const cur = $derived(sim.play.active ? sim.play.seg : -1)
  const law = $derived.by(() => {
    if (!n) return null
    const i = sim.play.active ? Math.min(sim.play.seg, n - 1) : 0
    const r = sim.resolved[i]
    // Waiting at a segment's start, "so far" would be 0 = 0 + 0; show the whole segment instead.
    const whole = !sim.play.active || (sim.play.s === 0 && !sim.play.playing)
    const s = whole ? 1 : sim.play.s
    return { i, r, whole, e: energy(sim.gas, r.segment.type, r.a, stateAt(sim.gas, r, s)) }
  })
  // Scaled to the values shown, so the bars are readable from the first moment of playback.
  const lawScale = $derived(
    law ? Math.max(1e-9, Math.abs(law.e.Q), Math.abs(law.e.dU), Math.abs(law.e.W)) : 1,
  )
  // A negative term is written in brackets: "+ (−421.7 J)", never "+ −421.7 J".
  const term = (v: number) => (fmtE(v).startsWith('−') ? `(${fmtE(v)} J)` : `${fmtE(v)} J`)
  const bar = (v: number) => {
    const w = Math.min(50, (Math.abs(v) / lawScale) * 50)
    return { left: v >= 0 ? 50 : 50 - w, w }
  }
  // Roving focus: ←/→ (and Home/End) move between the tabs, as the ARIA tabs pattern expects.
  function onTabKey(e: KeyboardEvent) {
    const ids = tabs.map(([id]) => id)
    const i = ids.indexOf(sim.tab)
    const j =
      e.key === 'ArrowRight'
        ? (i + 1) % ids.length
        : e.key === 'ArrowLeft'
          ? (i + ids.length - 1) % ids.length
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? ids.length - 1
              : -1
    if (j < 0) return
    e.preventDefault()
    e.stopPropagation()
    sim.tab = ids[j]
    document.getElementById(`tab-${ids[j]}`)?.focus()
  }
</script>

<div class="panel">
  <div class="tabs" role="tablist">
    {#each tabs as [id, label] (id)}
      <button
        class="tab"
        role="tab"
        id="tab-{id}"
        aria-controls="tabpanel"
        aria-selected={sim.tab === id}
        tabindex={sim.tab === id ? 0 : -1}
        onclick={() => (sim.tab = id)}
        onkeydown={onTabKey}>{label}</button
      >
    {/each}
  </div>
  <div class="tabpanel" role="tabpanel" id="tabpanel" aria-labelledby="tab-{sim.tab}">
    {#if sim.tab === 'table'}
      {#if !n}
        <div class="empty">구간을 그리면 여기에 구간별 에너지가 쌓여요.</div>
      {:else}
        <div class="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>구간</th><th>과정</th><th>V (L)</th><th>P (kPa)</th><th>T (K)</th><th
                  >끝값 수정</th
                ><th>W (J)</th><th>Q (J)</th><th>ΔU (J)</th>
              </tr>
            </thead>
            <tbody>
              {#each sim.resolved as r, i (r.segment.id)}
                {@const iso = r.segment.type === 'isochoric'}
                {@const lock = sim.closed && i === n - 1}
                {@const e = r.energy}
                <tr class:current={i === cur}>
                  <td><b>{LETTERS[i]}→{toLabel(i)}</b></td>
                  <td
                    ><span class="pchip"
                      ><Swatch type={r.segment.type} width={28} />{PROC[r.segment.type].name}</span
                    ></td
                  >
                  <td class="num">{f1(r.a.V)}→{f1(r.b.V)}</td>
                  <td class="num">{f0(r.a.P)}→{f0(r.b.P)}</td>
                  <td class="num">{f0(r.a.T)}→{f0(r.b.T)}</td>
                  <td>
                    <span style="font-size:11px;color:var(--muted)">{iso ? 'P₂' : 'V₂'}</span>
                    <input
                      class="endin"
                      type="number"
                      step={iso ? 5 : 0.5}
                      value={iso ? f0(r.b.P) : f1(r.b.V)}
                      disabled={lock}
                      title={lock ? '순환을 닫는 구간은 A에 고정돼요' : undefined}
                      aria-label="{LETTERS[i]}→{toLabel(i)} 끝값"
                      onchange={(ev) => onEnd(i, ev)}
                    />
                  </td>
                  <td class="num"
                    >{fmtE(e.W)}<small class="say">{say(e.W, '기체가 함', '기체가 받음')}</small
                    ></td
                  >
                  <td class="num"
                    >{fmtE(e.Q)}<small class="say">{say(e.Q, '받음', '잃음')}</small></td
                  >
                  <td class="num">{fmtE(e.dU)}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    {:else if sim.tab === 'law'}
      {#if !law}
        <div class="empty">구간을 그리면 과정마다 Q = ΔU + W가 맞아떨어지는 모습을 보여줘요.</div>
      {:else}
        {@const e = law.e}
        <div class="law">
          <div>
            <div class="law-title">
              {LETTERS[law.i]}→{toLabel(law.i)}
              {PROC[law.r.segment.type].full} · {law.whole ? '구간 전체' : '지금까지'}
            </div>
            <div class="law-eq num">{fmtE(e.Q)} J = {term(e.dU)} + {term(e.W)}</div>
            <p class="hint-muted">
              열 Q는 내부 에너지 변화 ΔU와 기체가 한 일 W로 나뉘어요. 재생하면 막대가 함께 자라요.
            </p>
          </div>
          <div class="bars">
            {#each [['Q', e.Q, 'heat'], ['ΔU', e.dU, 'du'], ['W', e.W, 'w']] as [k, v, cls] (k)}
              {@const b = bar(v as number)}
              <div class="barrow">
                <span class="k num">{k}</span>
                <span class="bartrack"
                  ><span class="zero"></span><i
                    class={cls as string}
                    style="left:{b.left}%;width:{b.w}%"
                  ></i></span
                >
              </div>
            {/each}
          </div>
        </div>
      {/if}
    {:else if !sim.cycle}
      <div class="empty">
        경로가 A로 돌아와 닫히면 알짜 일, 흡수·방출 열, 열효율이 여기에 나타나요. 예시에서 카르노
        순환을 골라 보세요.
      </div>
    {:else}
      {@const c = sim.cycle}
      {#if c.kind === 'engine'}
        <div class="limit">
          <div class="limit-row">
            <span>이 순환의 열효율 η</span><span class="track"
              ><i style="width:{Math.max(0, c.efficiency * 100)}%"></i></span
            ><span class="num">{pct(c.efficiency)}</span>
          </div>
          <div class="limit-row ref">
            <span>카르노 한계 η<sub>C</sub></span><span class="track"
              ><i style="width:{c.carnotEfficiency * 100}%"></i></span
            ><span class="num">{pct(c.carnotEfficiency)}</span>
          </div>
        </div>
        <dl class="totals">
          <div>
            <dt>알짜 일 W<sub>net</sub></dt>
            <dd class="num">{fmtE(c.Wnet)} J</dd>
          </div>
          <div>
            <dt>받은 열 Q<sub>in</sub></dt>
            <dd class="num">{fmtE(c.Qin)} J</dd>
          </div>
          <div>
            <dt>잃은 열 Q<sub>out</sub></dt>
            <dd class="num">{fmtE(c.Qout)} J</dd>
          </div>
        </dl>
        <p class="hint-muted">
          η = W<sub>net</sub>/Q<sub>in</sub>. 카르노 한계는 열을 받는 고온 {f0(c.Tsrc)} K와 열을 버리는
          저온 {f0(c.Tsink)} K 사이에서 낼 수 있는 가장 높은 효율이에요.{note}
        </p>
      {:else if c.kind === 'refrigerator'}
        {@const top = Math.max(c.cop, c.carnotCop)}
        <div class="limit">
          <div class="limit-row">
            <span>이 순환의 성능계수 COP</span><span class="track"
              ><i style="width:{(c.cop / top) * 100}%"></i></span
            ><span class="num">{c.cop.toFixed(2)}</span>
          </div>
          <div class="limit-row ref">
            <span>카르노 한계 COP<sub>C</sub></span><span class="track"
              ><i style="width:{(c.carnotCop / top) * 100}%"></i></span
            ><span class="num">{c.carnotCop.toFixed(2)}</span>
          </div>
        </div>
        <dl class="totals">
          <div>
            <dt>받은 일 W<sub>in</sub></dt>
            <dd class="num">{fmtE(c.Win)} J</dd>
          </div>
          <div>
            <dt>실내에서 뺀 열 Q<sub>C</sub></dt>
            <dd class="num">{fmtE(c.Qc)} J</dd>
          </div>
          <div>
            <dt>실외로 버린 열 Q<sub>H</sub></dt>
            <dd class="num">{fmtE(c.Qh)} J</dd>
          </div>
        </dl>
        <p class="hint-muted">
          반시계 방향으로 돌며 일을 받아 실내의 열을 실외로 옮겨요. COP = Q<sub>C</sub>/W<sub
            >in</sub
          >. 카르노 한계는 실내 {f0(c.Tsrc)} K와 실외 {f0(c.Tsink)} K 사이의 COP예요.{note}
        </p>
      {:else}
        <p class="limit-note">
          일을 받아 돌지만 냉방기는 아니에요. 열을 받는 동안 기체는 {f0(c.Tsrc)} K까지 뜨거워지고, 잃는
          동안에도 {f0(c.Tsink)} K 아래로 식지 않아요. 그래서 열은 뜨거운 곳에서 차가운 곳으로 흐르기만
          해요. 냉방기가 되려면 차가울 때 열을 받고 뜨거울 때 열을 버려야 해요.
        </p>
        <dl class="totals">
          <div>
            <dt>받은 일 W<sub>in</sub></dt>
            <dd class="num">{fmtE(c.Win)} J</dd>
          </div>
          <div>
            <dt>받은 열 Q<sub>in</sub></dt>
            <dd class="num">{fmtE(c.Qin)} J</dd>
          </div>
          <div>
            <dt>잃은 열 Q<sub>out</sub></dt>
            <dd class="num">{fmtE(c.Qout)} J</dd>
          </div>
        </dl>
      {/if}
    {/if}
  </div>
</div>

<script lang="ts">
  import { LETTERS, PRESET_NOTE, PROC, f0, f1, fmtE } from '../i18n/ko'
  import { sim, type PanelTab } from '../store/simulation.svelte'
  import Swatch from './Swatch.svelte'
  import { energy } from '../physics/processes'
  import { stateAt } from '../physics/path'

  const tabs: [PanelTab, string][] = [
    ['table', '구간과 에너지'],
    ['law', '제1법칙 Q = ΔU + W'],
    ['cycle', '순환 분석'],
  ]

  const n = $derived(sim.resolved.length)
  const toLabel = (i: number) => (sim.closed && i === n - 1 ? 'A' : LETTERS[i + 1])
  const note = $derived(sim.preset ? ' ' + PRESET_NOTE[sim.preset] : '')
  const cls = (v: number, pos: string, neg: string) => (v > 0.05 ? pos : v < -0.05 ? neg : '')

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

  // The law tab follows the playhead; without one it shows the last segment in full.
  const cur = $derived(sim.play.active ? sim.play.seg : -1)
  const law = $derived.by(() => {
    if (!n) return null
    const i = sim.play.active ? Math.min(sim.play.seg, n - 1) : n - 1
    const r = sim.resolved[i]
    const s = sim.play.active ? sim.play.s : 1
    return { i, r, e: energy(sim.gas, r.segment.type, r.a, stateAt(sim.gas, r, s)) }
  })
  const lawScale = $derived(
    law
      ? Math.max(1, Math.abs(law.r.energy.Q), Math.abs(law.r.energy.dU), Math.abs(law.r.energy.W))
      : 1,
  )
  const bar = (v: number) => {
    const w = Math.min(50, (Math.abs(v) / lawScale) * 50)
    return { left: v >= 0 ? 50 : 50 - w, w }
  }
</script>

<div class="panel">
  <div class="tabs" role="tablist">
    {#each tabs as [id, label] (id)}
      <button class="tab" role="tab" aria-selected={sim.tab === id} onclick={() => (sim.tab = id)}
        >{label}</button
      >
    {/each}
  </div>
  <div class="tabpanel" role="tabpanel">
    {#if sim.tab === 'table'}
      {#if !n}
        <div class="empty">
          {sim.start
            ? '아직 그린 구간이 없어요. 과정 도구를 고르고 그래프에 다음 상태를 정하세요.'
            : '그래프를 눌러 시작 상태 A를 정하면 여기에 구간별 에너지가 쌓입니다.'}
        </div>
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
                      ><Swatch type={r.segment.type} width={18} />{PROC[r.segment.type].name}</span
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
                  <td class="num {cls(e.W, 'pos', 'neg')}">{fmtE(e.W)}</td>
                  <td class="num {cls(e.Q, 'qin', 'qout')}">{fmtE(e.Q)}</td>
                  <td class="num">{fmtE(e.dU)}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
        <div class="hint-muted">
          부호: Q &gt; 0 흡열, W &gt; 0 기체가 외부에 한 일. 끝값을 고치면 뒤 구간은 과정 종류를
          유지한 채 다시 계산돼요.
        </div>
      {/if}
    {:else if sim.tab === 'law'}
      <div class="law">
        {#if !law}
          <div class="law-eq">
            <div class="empty">
              구간을 그리면 과정마다 Q = ΔU + W가 실시간으로 맞아떨어지는 모습을 보여줘요.
            </div>
          </div>
        {:else}
          {@const e = law.e}
          {@const pr = PROC[law.r.segment.type]}
          <div class="law-eq">
            <b style="color:var(--ink)">{LETTERS[law.i]}→{toLabel(law.i)} {pr.full}</b> · {pr.law}
            <span class="big">{fmtE(e.Q)} = {fmtE(e.dU)} + {fmtE(e.W)}</span>
            지금까지 흡수한 열(Q)이 내부 에너지 변화(ΔU)와 기체가 한 일(W)로 나뉩니다. 재생하면 막대가
            함께 자라요.
          </div>
          <div class="bars">
            {#each [['Q', e.Q, e.Q >= 0 ? 'var(--heat-in)' : 'var(--heat-out)'], ['ΔU', e.dU, 'var(--p-isochoric)'], ['W', e.W, e.W >= 0 ? 'var(--work-pos)' : 'var(--work-neg)']] as [k, v, col] (k)}
              {@const b = bar(v as number)}
              <div class="barrow">
                <span class="k">{k}</span>
                <span class="bartrack"
                  ><span class="zero"></span><i style="left:{b.left}%;width:{b.w}%;background:{col}"
                  ></i></span
                >
                <span class="v">{fmtE(v as number)} J</span>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {:else if !sim.cycle}
      <div class="empty">
        경로가 A로 돌아와 닫히면 알짜 일, 흡수·방출 열, 열효율이 여기에 나타나요. 예시에서 카르노
        순환을 골라 보세요.
      </div>
    {:else if sim.cycle.kind === 'refrigerator'}
      {@const c = sim.cycle}
      {@const top = Math.max(c.cop, c.carnotCop)}
      <div class="cycle">
        <div class="stat hl">
          <div class="k">받은 일 W<sub>in</sub></div>
          <div class="v">{fmtE(c.Win)} J</div>
        </div>
        <div class="stat">
          <div class="k">저온부(실내)에서 흡수 Q<sub>C</sub></div>
          <div class="v qout">{fmtE(c.Qc)} J</div>
        </div>
        <div class="stat">
          <div class="k">고온부(실외)로 방출 Q<sub>H</sub></div>
          <div class="v qin">{fmtE(c.Qh)} J</div>
        </div>
        <div class="stat">
          <div class="k">한 바퀴 ΣΔU</div>
          <div class="v">{fmtE(c.sumDU)} J</div>
        </div>
        <div class="stat hl">
          <div class="k">성능계수 COP = Q<sub>C</sub>/W<sub>in</sub></div>
          <div class="v">{c.cop.toFixed(2)}</div>
        </div>
      </div>
      <div class="effbar">
        <div class="effrow">
          <span>이 순환 COP</span><span class="efftrack"
            ><i style="width:{Math.min(100, (c.cop / top) * 100)}%;background:var(--accent)"
            ></i></span
          ><span class="num">{c.cop.toFixed(2)}</span>
        </div>
        <div class="effrow">
          <span>카르노 COP</span><span class="efftrack"
            ><i style="width:{Math.min(100, (c.carnotCop / top) * 100)}%;background:var(--muted)"
            ></i></span
          ><span class="num">{c.carnotCop.toFixed(2)}</span>
        </div>
      </div>
      <div class="hint-muted">
        경로가 반시계 방향으로 돌아 알짜 일이 음수(기체가 일을 받음)이므로 냉방기입니다. Q<sub
          >H</sub
        >
        = Q<sub>C</sub>
        + W<sub>in</sub>. 카르노 COP = T<sub>min</sub>/(T<sub>max</sub> − T<sub>min</sub>) = {f0(
          c.Tmin,
        )}/({f0(c.Tmax)} − {f0(c.Tmin)}).{note}
      </div>
    {:else}
      {@const c = sim.cycle}
      <div class="cycle">
        <div class="stat hl">
          <div class="k">알짜 일 W<sub>net</sub></div>
          <div class="v">{fmtE(c.Wnet)} J</div>
        </div>
        <div class="stat">
          <div class="k">흡수한 열 Q<sub>in</sub></div>
          <div class="v qin">{fmtE(c.Qin)} J</div>
        </div>
        <div class="stat">
          <div class="k">방출한 열 Q<sub>out</sub></div>
          <div class="v qout">{fmtE(c.Qout)} J</div>
        </div>
        <div class="stat">
          <div class="k">한 바퀴 ΣΔU</div>
          <div class="v">{fmtE(c.sumDU)} J</div>
        </div>
        <div class="stat hl">
          <div class="k">열효율 η = W/Q<sub>in</sub></div>
          <div class="v">{(c.efficiency * 100).toFixed(1)}%</div>
        </div>
      </div>
      <div class="effbar">
        <div class="effrow">
          <span>이 순환 η</span><span class="efftrack"
            ><i style="width:{Math.max(0, c.efficiency * 100)}%;background:var(--accent)"></i></span
          ><span class="num">{(c.efficiency * 100).toFixed(1)}%</span>
        </div>
        <div class="effrow">
          <span>카르노 η<sub>C</sub></span><span class="efftrack"
            ><i style="width:{c.carnotEfficiency * 100}%;background:var(--muted)"></i></span
          ><span class="num">{(c.carnotEfficiency * 100).toFixed(1)}%</span>
        </div>
      </div>
      <div class="hint-muted">
        η<sub>C</sub> = 1 − T<sub>min</sub>/T<sub>max</sub> = 1 − {f0(c.Tmin)}/{f0(c.Tmax)}.
        그래프의 파란 영역이 알짜 일이에요.{note}
      </div>
    {/if}
  </div>
</div>

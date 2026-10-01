<script lang="ts">
  import { PRESET_GROUPS, PRESET_NOTE } from '../i18n/ko'
  import type { PresetName } from '../presets/cycles'
  import { sim } from '../store/simulation.svelte'

  function onPreset(e: Event) {
    const v = (e.currentTarget as HTMLSelectElement).value as PresetName | ''
    if (!v) {
      sim.preset = ''
      return
    }
    sim.loadPreset(v)
    sim.notify(PRESET_NOTE[v])
  }

  function onGas(e: Event) {
    const di = (e.currentTarget as HTMLSelectElement).value === 'di'
    sim.setGas(di ? 'di' : 'mono')
    sim.notify(di ? '이원자 기체: Cv = 5R/2, 단열선이 덜 가팔라져요' : '단원자 기체: Cv = 3R/2')
  }

  function toggleTheme() {
    const r = document.documentElement
    const dark = r.dataset.theme
      ? r.dataset.theme === 'dark'
      : matchMedia('(prefers-color-scheme: dark)').matches
    r.dataset.theme = dark ? 'light' : 'dark'
  }
</script>

<div class="appbar">
  <div class="brand">
    <div class="brand-mark" aria-hidden="true">
      <svg width="18" height="18" viewBox="0 0 18 18"
        ><rect
          x="4"
          y="2"
          width="10"
          height="14"
          rx="1.5"
          fill="none"
          stroke="#EDF1F4"
          stroke-width="1.5"
        /><rect x="4.8" y="6" width="8.4" height="2" fill="#EDF1F4" /><circle
          cx="7"
          cy="11.5"
          r="1"
          fill="#F0A24E"
        /><circle cx="11" cy="13" r="1" fill="#5A9CF2" /><circle
          cx="10"
          cy="10"
          r="1"
          fill="#EE6E92"
        /></svg
      >
    </div>
    <div style="min-width:0">
      <h1 class="brand-name" style="margin:0">열역학 과정 시뮬레이터</h1>
      <div class="brand-sub">이상기체 · PV 그래프 + 가상 열기관</div>
    </div>
  </div>
  <div class="bar-group">
    <label class="field"
      ><span class="hide-sm">예시</span>
      <select class="select" aria-label="예시 경로" value={sim.preset} onchange={onPreset}>
        <option value="">직접 그리기</option>
        {#each PRESET_GROUPS as g (g.label)}
          <optgroup label={g.label}>
            {#each g.items as [value, label] (value)}
              <option {value}>{label}</option>
            {/each}
          </optgroup>
        {/each}
      </select>
    </label>
    <label class="field"
      ><span class="hide-sm">기체</span>
      <select
        class="select"
        aria-label="기체 종류"
        value={sim.gas.gamma < 1.5 ? 'di' : 'mono'}
        onchange={onGas}
      >
        <option value="mono">단원자 γ=5/3</option>
        <option value="di">이원자 γ=7/5</option>
      </select>
    </label>
    <button
      class="btn hide-sm"
      aria-pressed={sim.guides}
      title="등온선·단열선 보조선"
      onclick={() => (sim.guides = !sim.guides)}
    >
      <svg width="16" height="16" viewBox="0 0 16 16"
        ><path
          d="M2 3c2 7 6 10 12 11M2 7c2 4 5 6 12 7"
          fill="none"
          stroke="currentColor"
          stroke-width="1.3"
          stroke-dasharray="2 2"
        /></svg
      >보조선</button
    >
    <button
      class="btn icon"
      title="라이트/다크 전환"
      aria-label="라이트/다크 전환"
      onclick={toggleTheme}
    >
      <svg width="16" height="16" viewBox="0 0 16 16"
        ><circle cx="8" cy="8" r="5.5" fill="none" stroke="currentColor" stroke-width="1.4" /><path
          d="M8 2.5a5.5 5.5 0 010 11z"
          fill="currentColor"
        /></svg
      ></button
    >
  </div>
</div>

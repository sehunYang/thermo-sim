<script lang="ts">
  import { PRESET_GROUPS, PRESET_NOTE } from '../i18n/ko'
  import type { PresetName } from '../presets/cycles'
  import { sim } from '../store/simulation.svelte'
  import { THEME_KEY, shareUrl } from '../share/urlState'

  async function share() {
    const saved = sim.saved
    if (!saved) {
      sim.notify('먼저 그래프에 경로를 그려 주세요')
      return
    }
    const url = shareUrl(location.href.split('#')[0], saved)
    history.replaceState(null, '', url)
    try {
      await navigator.clipboard.writeText(url)
      sim.notify('지금 경로가 담긴 링크를 복사했어요')
    } catch {
      sim.notify('주소창의 링크를 복사해 공유하세요')
    }
  }

  // On a closed select, arrow keys change the value (and fire change) at every step. Loading an
  // example per keystroke would wipe the drawing while the viewer is only browsing, so keyboard
  // changes wait for Enter or for focus to leave.
  let keyed = false
  let pending: PresetName | '' | null = null

  function apply(v: PresetName | '') {
    pending = null
    if (v === sim.preset) return
    if (!v) {
      sim.preset = ''
      return
    }
    sim.loadPreset(v)
    sim.notify(PRESET_NOTE[v])
  }

  function onPreset(e: Event) {
    const v = (e.currentTarget as HTMLSelectElement).value as PresetName | ''
    if (keyed) pending = v
    else apply(v)
  }

  function onPresetKey(e: KeyboardEvent) {
    if (e.key === 'Enter' && pending != null) {
      e.preventDefault()
      apply(pending)
    } else if (e.key !== 'Tab') keyed = true
  }

  function onPresetBlur() {
    keyed = false
    if (pending != null) apply(pending)
  }

  function onGas(e: Event) {
    const di = (e.currentTarget as HTMLSelectElement).value === 'di'
    sim.setGas(di ? 'di' : 'mono')
    sim.notify(
      di
        ? '이원자 기체(공기처럼 원자 둘): 온도를 같은 만큼 올리는 데 열이 더 들고, 단열선이 덜 가팔라요'
        : '단원자 기체(헬륨처럼 원자 하나): 단열선이 가장 가팔라요',
    )
  }

  function toggleTheme() {
    const r = document.documentElement
    const dark = r.dataset.theme
      ? r.dataset.theme === 'dark'
      : matchMedia('(prefers-color-scheme: dark)').matches
    r.dataset.theme = dark ? 'light' : 'dark'
    try {
      localStorage.setItem(THEME_KEY, r.dataset.theme)
    } catch {
      // Without storage the choice lasts until reload.
    }
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
          fill="#EDF1F4"
        /><circle cx="11" cy="13" r="1" fill="#EDF1F4" /><circle
          cx="10"
          cy="10"
          r="1"
          fill="#EDF1F4"
        /></svg
      >
    </div>
    <div style="min-width:0">
      <h1 class="brand-name" style="margin:0">열역학 과정 시뮬레이터</h1>
    </div>
  </div>
  <div class="bar-group">
    <label class="field"
      ><span class="hide-sm">예시</span>
      <select
        class="select"
        aria-label="예시 경로"
        value={sim.preset}
        onchange={onPreset}
        onkeydown={onPresetKey}
        onpointerdown={() => (keyed = false)}
        onblur={onPresetBlur}
      >
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
      class="btn"
      aria-pressed={sim.guides}
      aria-label="보조선"
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
      ><span class="hide-sm">보조선</span></button
    >
    <button class="btn icon" title="공유 링크 복사" aria-label="공유 링크 복사" onclick={share}>
      <svg width="16" height="16" viewBox="0 0 16 16"
        ><path
          d="M6.5 9.5l3-3M5 7.5L3.6 8.9a2.5 2.5 0 003.5 3.5L8.5 11M11 8.5l1.4-1.4a2.5 2.5 0 00-3.5-3.5L7.5 5"
          fill="none"
          stroke="currentColor"
          stroke-width="1.4"
          stroke-linecap="round"
        /></svg
      ></button
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
    <button
      class="btn icon"
      title="도움말"
      aria-label="도움말"
      onclick={() => (sim.help = 'start')}
    >
      <svg width="16" height="16" viewBox="0 0 16 16"
        ><circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="1.4" /><path
          d="M6.3 6.3a1.8 1.8 0 113 1.3c-.7.5-1.3.8-1.3 1.7"
          fill="none"
          stroke="currentColor"
          stroke-width="1.4"
          stroke-linecap="round"
        /><circle cx="8" cy="11.4" r=".8" fill="currentColor" /></svg
      ></button
    >
  </div>
</div>

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

  // Guides, share, theme and help live behind one button: they are used now and then, not
  // every minute, so they don't need a place on screen.
  let menuOpen = $state(false)
  let menuBtn: HTMLButtonElement | undefined = $state()
  let menu: HTMLDivElement | undefined = $state()
  const items = () => [...(menu?.querySelectorAll<HTMLElement>('[role^="menuitem"]') ?? [])]
  function openMenu() {
    menuOpen = true
    queueMicrotask(() => items()[0]?.focus())
  }
  function closeMenu(refocus = true) {
    menuOpen = false
    if (refocus) menuBtn?.focus()
  }
  function pick(fn: () => void) {
    // Back on the menu button first, so a dialog opened from here returns focus to it.
    closeMenu()
    fn()
  }
  function onMenuKey(e: KeyboardEvent) {
    const all = items()
    const i = all.indexOf(document.activeElement as HTMLElement)
    if (e.key === 'Escape') {
      e.stopPropagation()
      closeMenu()
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const d = e.key === 'ArrowDown' ? 1 : -1
      all[(i + d + all.length) % all.length]?.focus()
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault()
      ;(e.key === 'Home' ? all[0] : all.at(-1))?.focus()
    } else if (e.key === 'Tab') closeMenu(false)
  }
  function onWinDown(e: PointerEvent) {
    if (!menuOpen) return
    const t = e.target as Node
    if (!menu?.contains(t) && !menuBtn?.contains(t)) closeMenu(false)
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

<svelte:window onpointerdown={onWinDown} />

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
          stroke="currentColor"
          stroke-width="1.5"
        /><rect x="4.8" y="6" width="8.4" height="2" fill="currentColor" /><circle
          cx="7"
          cy="11.5"
          r="1"
          fill="currentColor"
        /><circle cx="11" cy="13" r="1" fill="currentColor" /><circle
          cx="10"
          cy="10"
          r="1"
          fill="currentColor"
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
    <div class="menu-wrap">
      <button
        class="btn icon"
        bind:this={menuBtn}
        aria-label="더 보기"
        title="보조선 · 공유 · 테마 · 도움말"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onclick={() => (menuOpen ? closeMenu() : openMenu())}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"
          ><circle cx="3.5" cy="8" r="1.3" fill="currentColor" /><circle
            cx="8"
            cy="8"
            r="1.3"
            fill="currentColor"
          /><circle cx="12.5" cy="8" r="1.3" fill="currentColor" /></svg
        >
      </button>
      {#if menuOpen}
        <div
          class="menu"
          role="menu"
          aria-label="더 보기"
          bind:this={menu}
          tabindex="-1"
          onkeydown={onMenuKey}
        >
          <button
            role="menuitemcheckbox"
            aria-checked={sim.guides}
            onclick={() => pick(() => (sim.guides = !sim.guides))}
            ><span class="menu-check" aria-hidden="true">{sim.guides ? '✓' : ''}</span>보조선
            (등온선·단열선)</button
          >
          <button role="menuitem" onclick={() => pick(share)}
            ><span class="menu-check"></span>공유 링크 복사</button
          >
          <button role="menuitem" onclick={() => pick(toggleTheme)}
            ><span class="menu-check"></span>라이트/다크 전환</button
          >
          <button role="menuitem" onclick={() => pick(() => (sim.help = 'start'))}
            ><span class="menu-check"></span>도움말</button
          >
        </div>
      {/if}
    </div>
  </div>
</div>

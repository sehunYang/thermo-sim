<script lang="ts">
  import type { ProcessType } from './physics/gas'
  import { STORAGE_KEY, decode, encode, readHash } from './share/urlState'
  import { sim } from './store/simulation.svelte'
  import AppBar from './ui/AppBar.svelte'
  import Coach from './ui/Coach.svelte'
  import Help from './ui/Help.svelte'
  import EngineView from './ui/EngineView.svelte'
  import Panel from './ui/Panel.svelte'
  import Playbar from './ui/Playbar.svelte'
  import PVGraph from './ui/PVGraph.svelte'
  import Toast from './ui/Toast.svelte'
  import Toolbar from './ui/Toolbar.svelte'

  const keyTools: Record<string, ProcessType> = {
    '1': 'isochoric',
    '2': 'isobaric',
    '3': 'isothermal',
    '4': 'adiabatic',
  }

  // Restore a shared link first, then the last autosaved path, before the autosave effect runs.
  function restore() {
    const shared = readHash(location.hash)
    if (shared) {
      sim.load(shared, false)
      sim.notify('공유 링크의 경로를 불러왔어요')
      return
    }
    try {
      const text = localStorage.getItem(STORAGE_KEY)
      const saved = text ? decode(text) : null
      if (saved) sim.load(saved, false)
    } catch {
      // Storage can be blocked (private mode); the app works without it.
    }
  }
  restore()

  // Before A, the scene, playbar and panel only preview what is coming: dimmed and inert, so
  // nothing half-visible can be pressed or tabbed to.
  let app: HTMLDivElement
  $effect(() => {
    const off = !sim.start
    for (const el of app.querySelectorAll<HTMLElement>('.engine-col, .playbar, .panel'))
      el.inert = off
  })

  // Show the two-step guide once, on the first visit.
  const SEEN_KEY = 'thermo-sim:coach-seen'
  try {
    if (!localStorage.getItem(SEEN_KEY)) {
      sim.coach = 1
      localStorage.setItem(SEEN_KEY, '1')
    }
  } catch {
    // Without storage, skip the automatic guide; the help button still opens it.
  }

  $effect(() => {
    const saved = sim.saved
    try {
      if (saved) localStorage.setItem(STORAGE_KEY, encode(saved))
      else localStorage.removeItem(STORAGE_KEY)
    } catch {
      // Ignore: autosave is a convenience.
    }
  })

  // Full screen uses the browser's own when it has one, so the address bar and taskbar go too.
  // Phones without it (iPhone Safari) still get the same layout filling the window.
  function enterFull() {
    sim.full = true
    app.requestFullscreen?.().catch(() => {})
  }
  function exitFull() {
    sim.full = false
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
  }
  // Esc in the browser's full screen leaves it without a key event reaching the page.
  function onFullChange() {
    if (!document.fullscreenElement) sim.full = false
  }

  function onKey(e: KeyboardEvent) {
    const target = e.target as HTMLElement
    if (target.matches('input,select,textarea') || sim.coach || sim.help) return
    if (e.key === 'Escape' && sim.full) {
      exitFull()
      return
    }
    const mod = e.ctrlKey || e.metaKey
    if (!mod && keyTools[e.key]) sim.tool = keyTools[e.key]
    // A focused button already reacts to Space itself.
    else if (e.code === 'Space' && !target.matches('button')) {
      e.preventDefault()
      sim.togglePlay()
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      if (target.matches('[role="tab"]')) return
      e.preventDefault()
      sim.step(e.key === 'ArrowRight' ? 1 : -1)
    } else if (mod && e.key.toLowerCase() === 'z') {
      e.preventDefault()
      if (e.shiftKey) sim.redo()
      else sim.undo()
    } else if (mod && e.key.toLowerCase() === 'y') {
      e.preventDefault()
      sim.redo()
    }
  }
</script>

<svelte:window onkeydown={onKey} />
<svelte:document onfullscreenchange={onFullChange} />

<!-- Before A exists there is one thing to do; everything but the graph steps back. -->
<div class="app" class:blank={!sim.start} class:full={sim.full} bind:this={app}>
  <AppBar />
  <div class="stage">
    <section class="graph-pane" aria-label="그래프">
      <Toolbar />
      <PVGraph />
    </section>
    <EngineView />
  </div>
  <Playbar onfull={() => (sim.full ? exitFull() : enterFull())} />
  <Panel />
  <Toast />
  <Coach />
  <Help />
</div>

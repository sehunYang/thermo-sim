<script lang="ts">
  import type { ProcessType } from './physics/gas'
  import { sim } from './store/simulation.svelte'
  import AppBar from './ui/AppBar.svelte'
  import Panel from './ui/Panel.svelte'
  import PVGraph from './ui/PVGraph.svelte'
  import Toast from './ui/Toast.svelte'
  import Toolbar from './ui/Toolbar.svelte'

  const keyTools: Record<string, ProcessType> = {
    '1': 'isochoric',
    '2': 'isobaric',
    '3': 'isothermal',
    '4': 'adiabatic',
  }

  function onKey(e: KeyboardEvent) {
    if ((e.target as HTMLElement).matches('input,select,textarea')) return
    const mod = e.ctrlKey || e.metaKey
    if (!mod && keyTools[e.key]) sim.tool = keyTools[e.key]
    else if (mod && e.key.toLowerCase() === 'z') {
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

<div class="app">
  <AppBar />
  <div class="stage">
    <section class="graph-pane" aria-label="PV 그래프">
      <Toolbar />
      <PVGraph />
    </section>
    <div class="engine-col">
      <section class="engine-pane" aria-label="가상 열기관">
        <div class="engine-soon">
          <b>가상 열기관</b>
          <span>피스톤·입자·열 흐름 3D 장면은 다음 단계에서 이 자리에 들어옵니다.</span>
        </div>
      </section>
    </div>
  </div>
  <Panel />
  <Toast />
</div>

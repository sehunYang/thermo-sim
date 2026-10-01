<script lang="ts">
  import { sim } from '../store/simulation.svelte'

  let visible = $state(false)
  $effect(() => {
    if (!sim.toast) return
    visible = true
    const t = setTimeout(() => (visible = false), 1800)
    return () => clearTimeout(t)
  })
</script>

{#if visible && sim.toast}
  <div class="toast" role="status">{sim.toast.msg}</div>
{/if}

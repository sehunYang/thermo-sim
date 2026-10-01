<script lang="ts">
  import type { ProcessType } from '../physics/gas'
  import { PROC } from '../i18n/ko'

  let { type, width = 22 }: { type: ProcessType; width?: number } = $props()
  const pr = $derived(PROC[type])
</script>

<svg {width} height="10" viewBox="0 0 {width} 10" aria-hidden="true">
  <line
    x1="1"
    y1="5"
    x2={width - 1}
    y2="5"
    stroke="var({pr.cssVar})"
    stroke-width="3"
    stroke-dasharray={pr.dash}
    stroke-linecap="round"
  />
</svg>

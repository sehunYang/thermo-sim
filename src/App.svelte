<script lang="ts">
  import { MONATOMIC, temperature } from './physics/gas'

  const T = temperature(MONATOMIC, 300, 10)
</script>

<main>
  <h1>열역학 과정 시뮬레이터</h1>
  <p>개발 중입니다. PV 그래프와 가상 열기관이 곧 이 자리에 들어옵니다.</p>
  <p class="probe">1 mol 단원자 기체, 300 kPa · 10 L → T = {T.toFixed(1)} K</p>
</main>

<style>
  main {
    max-width: 40rem;
    margin: 0 auto;
    padding: 3rem 1rem;
  }
  .probe {
    color: var(--muted);
    font-variant-numeric: tabular-nums;
  }
</style>

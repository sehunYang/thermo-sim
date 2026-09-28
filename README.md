# thermo-sim

PV 그래프에 등적·등압·등온·단열 과정을 그리고 **실행**을 누르면, 오른쪽의 가상 열기관(Three.js)이 입자 운동, 열 출입, 팽창·압축을 그래프와 맞춰 보여 주는 교육용 시뮬레이터입니다.

배포: https://sehunyang.github.io/thermo-sim/

## 개발

Node 22가 필요합니다.

```sh
npm install
npm run dev        # 개발 서버
npm test           # 물리 단위 테스트 (Vitest)
npm run test:e2e   # 스모크 테스트 (Playwright)
npm run lint       # ESLint + Prettier
npm run check      # svelte-check + tsc
```

`main`에 푸시하면 GitHub Actions가 빌드해서 GitHub Pages에 배포합니다.

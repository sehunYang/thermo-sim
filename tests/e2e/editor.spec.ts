import { expect, test, type Page } from '@playwright/test'

/** Click the PV graph at a state, converting (V, P) to screen coordinates through the SVG. */
async function clickAt(page: Page, V: number, P: number) {
  const pt = await page.evaluate(
    ([V, P]) => {
      const svg = document.querySelector<SVGSVGElement>('svg[aria-label="압력-부피 그래프"]')!
      // On phones the playbar sticks to the bottom; keep the graph clear of it.
      svg.scrollIntoView({ block: 'center' })
      const G = { L: 58, R: 18, T: 16, B: 46, W: 560, H: 440 }
      const PW = G.W - G.L - G.R
      const PH = G.H - G.T - G.B
      const p = svg.createSVGPoint()
      p.x = G.L + (V / 50) * PW
      p.y = G.T + PH - (P / 500) * PH
      const s = p.matrixTransform(svg.getScreenCTM()!)
      return { x: s.x, y: s.y }
    },
    [V, P],
  )
  await page.mouse.move(pt.x, pt.y)
  await page.mouse.down()
  await page.mouse.up()
}

test('a Carnot cycle can be drawn by hand and closes', async ({ page }) => {
  await page.goto('./')
  const R = 8.314
  const g = 5 / 3
  // A on the 500 K isotherm (snapped to the 5 kPa grid), B by isothermal expansion.
  const A = { V: 10, P: 415 }
  const TA = (A.P * A.V) / R
  const k = Math.pow(TA / 300, 1 / (g - 1))
  const B = { V: 20, P: (A.P * A.V) / 20 }
  const VC = Math.round(20 * k * 2) / 2
  const PC = B.P * Math.pow(20 / VC, g)
  const VD = Math.round(10 * k * 2) / 2

  await clickAt(page, A.V, A.P)
  await page.keyboard.press('3')
  await clickAt(page, B.V, B.P)
  await page.keyboard.press('4')
  await clickAt(page, VC, PC)
  await page.keyboard.press('3')
  await clickAt(page, VD, (PC * VC) / VD)
  await page.keyboard.press('4')
  await clickAt(page, A.V, A.P)

  await expect(page.getByText('순환이 닫혔어요 · 실행을 눌러 보세요')).toBeVisible()
  await expect(page.locator('tbody tr')).toHaveCount(4)
  await page.getByRole('tab', { name: '순환 분석' }).click()
  await expect(page.getByText('열효율 η = W/Qin')).toBeVisible()
})

test('undo removes the last segment and redo restores it', async ({ page }) => {
  await page.goto('./')
  await clickAt(page, 10, 300)
  await clickAt(page, 20, 150)
  await expect(page.locator('tbody tr')).toHaveCount(1)
  await page.keyboard.press('Control+z')
  await expect(page.locator('tbody tr')).toHaveCount(0)
  await page.keyboard.press('Control+y')
  await expect(page.locator('tbody tr')).toHaveCount(1)
})

test('presets load and show the cycle analysis', async ({ page }) => {
  await page.goto('./')
  await page.getByLabel('예시 경로').selectOption('revcarnot')
  await page.getByRole('tab', { name: '순환 분석' }).click()
  await expect(page.getByText('3.00').first()).toBeVisible()
})

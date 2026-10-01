import { expect, test } from '@playwright/test'

test('the corner button cycles P-V, P-T and T-S, and drawing works in T-S', async ({ page }) => {
  await page.goto('./')
  const btn = page.getByRole('button', { name: /그래프 바꾸기/ })
  await expect(btn).toHaveText('P-V')
  await btn.click()
  await expect(btn).toHaveText('P-T')
  await expect(page.locator('svg[aria-label="압력-온도 그래프"]')).toBeVisible()
  await btn.click()
  await expect(btn).toHaveText('T-S')
  const svg = page.locator('svg[aria-label="온도-엔트로피 그래프"]')
  await expect(svg).toBeVisible()

  // Plot fractions to screen points through the SVG (viewBox 560 × 440, plot 58..542 × 16..394).
  const at = async (fx: number, fy: number) => {
    const pt = await svg.evaluate(
      (el, [fx, fy]) => {
        const s = el as SVGSVGElement
        s.scrollIntoView({ block: 'center' })
        const p = s.createSVGPoint()
        p.x = 58 + fx * 484
        p.y = 16 + (1 - fy) * 378
        const r = p.matrixTransform(s.getScreenCTM()!)
        return { x: r.x, y: r.y }
      },
      [fx, fy],
    )
    await page.mouse.move(pt.x, pt.y)
    await page.mouse.down()
    await page.mouse.up()
  }
  // A at about 500 K; T-S places it at S = 0 and 100 kPa.
  await at(0.5, 0.5)
  await expect(page.getByText('압력은 100 kPa로 잡았어요')).toBeVisible()
  // Adiabatic compression: straight up in T-S.
  await page.keyboard.press('4')
  await at(0.7, 0.75)
  await expect(page.locator('tbody tr')).toHaveCount(1)
  await expect(page.locator('tbody tr').first()).toContainText('0')
  // Back to P-V: the same segment is there.
  await btn.click()
  await expect(btn).toHaveText('P-V')
  await expect(page.locator('tbody tr')).toHaveCount(1)
})

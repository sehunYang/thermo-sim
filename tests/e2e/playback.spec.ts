import { expect, test } from '@playwright/test'

test('running a preset plays it through and highlights the current segment', async ({ page }) => {
  await page.goto('./')
  await page.getByLabel('예시 경로').selectOption('isothermal')
  await page.getByLabel('재생 속도').selectOption('4')
  await page.getByRole('button', { name: '실행' }).click()
  await expect(page.locator('.graph-status', { hasText: 'A→B 등온 과정' })).toBeVisible()
  await expect(page.locator('tbody tr.current')).toHaveCount(1)
  await expect(page.getByText('재생 완료')).toBeVisible({ timeout: 5000 })
  await expect(page.getByRole('button', { name: '실행' })).toBeVisible()
})

test('scrubbing pauses and moves the playhead', async ({ page }) => {
  await page.goto('./')
  await page.getByLabel('예시 경로').selectOption('carnot')
  await page.getByLabel('재생 위치').fill('625')
  await expect(page.getByText('C→D 등온 과정 · 일시정지')).toBeVisible()
  await expect(page.getByRole('button', { name: '계속' })).toBeVisible()
})

test('a paused or scrubbed playhead still says which way heat goes', async ({ page }) => {
  await page.goto('./')
  await page.getByLabel('예시 경로').selectOption('carnot')
  const chip = page.locator('.hud-proc .chip').nth(1)
  // Carnot: A→B isothermal absorbs, B→C adiabatic, C→D isothermal rejects, D→A adiabatic.
  const expected = ['열 받음', '열 출입 없음', '열 잃음', '열 출입 없음']
  for (const f of [0.03, 0.12, 0.2, 0.31, 0.4, 0.49, 0.51, 0.6, 0.74, 0.76, 0.9, 0.99]) {
    await page.getByLabel('재생 위치').fill(String(Math.round(f * 1000)))
    await expect(chip).toContainText(expected[Math.floor(f * 4)])
  }
})

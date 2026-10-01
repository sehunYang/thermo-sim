import { expect, test } from '@playwright/test'

test('running a preset plays it through and highlights the current segment', async ({ page }) => {
  await page.goto('./')
  await page.getByLabel('예시 경로').selectOption('isothermal')
  await page.getByLabel('재생 속도').selectOption('4')
  await page.getByRole('button', { name: '실행' }).click()
  await expect(page.getByText('A→B 등온 과정 재생 중')).toBeVisible()
  await expect(page.locator('tbody tr.current')).toHaveCount(1)
  await expect(page.getByText('재생 완료')).toBeVisible({ timeout: 5000 })
  await expect(page.getByRole('button', { name: '실행' })).toBeVisible()
})

test('scrubbing pauses and moves the playhead', async ({ page }) => {
  await page.goto('./')
  await page.getByLabel('예시 경로').selectOption('carnot')
  await page.getByLabel('재생 위치').fill('625')
  await expect(page.getByText('C→D 등온 과정 재생 중')).toBeVisible()
  await expect(page.getByRole('button', { name: '계속' })).toBeVisible()
})

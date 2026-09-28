import { expect, test } from '@playwright/test'

test('app loads without console errors', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('./')
  await expect(page.getByRole('heading', { name: '열역학 과정 시뮬레이터' })).toBeVisible()
  expect(errors).toEqual([])
})

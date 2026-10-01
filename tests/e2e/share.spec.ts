import { expect, test } from '@playwright/test'

test('a share link restores the path', async ({ page }) => {
  // Carnot-like cycle drawn as a link: start 10 L / 415 kPa, iso → adia → iso → adia, closed.
  await page.goto('./#p=m;10,415;3:20,4:43,3:21.5,4:10;c')
  await expect(page.locator('tbody tr')).toHaveCount(4)
  await expect(page.getByText('순환이 닫혔어요 · 실행을 눌러 보세요')).toBeVisible()
})

test('the drawn path survives a reload', async ({ page }) => {
  await page.goto('./')
  await page.getByLabel('예시 경로').selectOption('otto')
  await expect(page.locator('tbody tr')).toHaveCount(4)
  await page.reload()
  await expect(page.locator('tbody tr')).toHaveCount(4)
})

test('a broken link is ignored', async ({ page }) => {
  await page.goto('./#p=garbage')
  await expect(page.getByText('그래프를 눌러 기체의 처음 상태 A를 찍으세요')).toBeVisible()
})

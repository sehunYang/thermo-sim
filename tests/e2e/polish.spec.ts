import { expect, test } from '@playwright/test'

test.describe('first visit', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('shows the three-step guide once', async ({ page }) => {
    await page.goto('./')
    const dialog = page.getByRole('dialog', { name: '사용 안내' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('1 / 3')).toBeVisible()
    await dialog.getByRole('button', { name: '다음' }).click()
    await dialog.getByRole('button', { name: '다음' }).click()
    await dialog.getByRole('button', { name: '시작하기' }).click()
    await expect(dialog).toBeHidden()
    await page.reload()
    await expect(page.getByRole('dialog', { name: '사용 안내' })).toBeHidden()
  })
})

test('the help button reopens the guide and Escape closes it', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('button', { name: '사용 안내' }).click()
  await expect(page.getByRole('dialog', { name: '사용 안내' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: '사용 안내' })).toBeHidden()
})

test('arrow keys step the playhead', async ({ page }) => {
  await page.goto('./')
  await page.getByLabel('예시 경로').selectOption('isothermal')
  await page.locator('body').click({ position: { x: 1, y: 1 } })
  await page.keyboard.press('ArrowRight')
  await expect(page.locator('.graph-status', { hasText: 'A→B 등온 과정' })).toBeVisible()
  await expect(page.getByRole('button', { name: '계속' })).toBeVisible()
})

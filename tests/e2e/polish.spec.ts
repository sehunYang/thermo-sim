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

test('help has a terms tab and can start the guide', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('button', { name: '더 보기' }).click()
  await page.getByRole('menuitem', { name: '도움말' }).click()
  const help = page.getByRole('dialog', { name: '도움말' })
  await expect(help).toBeVisible()
  await page.keyboard.press('ArrowRight')
  await expect(help.getByRole('tab', { name: '용어와 부호' })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  for (const k of ['γ', 'ΔU', 'COP', 'Win · QC · QH', 'U자관']) {
    await expect(help.getByText(k, { exact: true })).toBeVisible()
  }
  await page.keyboard.press('ArrowLeft')
  await help.getByRole('button', { name: '화면에서 따라 하기' }).click()
  await expect(page.getByRole('dialog', { name: '사용 안내' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: '사용 안내' })).toBeHidden()
})

test('a cycle can be drawn, played and inspected with the keyboard alone', async ({ page }) => {
  await page.goto('./')
  const graph = page.locator('svg[aria-label="압력-부피 그래프"]')
  for (let i = 0; i < 40 && !(await graph.evaluate((el) => el === document.activeElement)); i++)
    await page.keyboard.press('Tab')
  await expect(graph).toBeFocused()
  // The cursor starts at 20 L, 200 kPa; Shift moves 5 L or 50 kPa per press.
  await page.keyboard.press('Enter')
  await expect(page.getByText('V 20.0 L · P 200 kPa', { exact: false }).first()).toBeAttached()
  const go = async (tool: string, key: string) => {
    await page.keyboard.press(tool)
    await page.keyboard.press(`Shift+${key}`)
    await page.keyboard.press(`Shift+${key}`)
    await page.keyboard.press('Enter')
  }
  await go('2', 'ArrowRight')
  await go('1', 'ArrowDown')
  await go('2', 'ArrowLeft')
  await go('1', 'ArrowUp')
  await expect(page.locator('tbody tr')).toHaveCount(4)
  await expect(page.locator('.graph-status')).toContainText('순환이 닫혔어요')
  await page.keyboard.press('Space')
  await expect(page.getByRole('button', { name: '일시정지' })).toBeVisible()
  await page.keyboard.press('Space')
  await page.getByRole('tab', { name: '구간과 에너지' }).focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('tab', { name: '제1법칙' })).toBeFocused()
  await page.keyboard.press('End')
  await expect(page.getByRole('tab', { name: '순환 분석' })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  await page.getByRole('button', { name: '더 보기' }).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('menuitemcheckbox', { name: /보조선/ })).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')
  await expect(page.locator('.toast')).toContainText('링크')
})

test('arrow keys on the example list only browse until Enter', async ({ page }) => {
  await page.goto('./')
  const sel = page.getByLabel('예시 경로')
  await sel.focus()
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('ArrowDown')
  await expect(page.locator('tbody tr')).toHaveCount(0)
  await page.keyboard.press('Enter')
  await expect(page.locator('tbody tr')).toHaveCount(1)
})

test('arrow keys step the playhead', async ({ page }) => {
  await page.goto('./')
  await page.getByLabel('예시 경로').selectOption('isothermal')
  await page.locator('body').click({ position: { x: 1, y: 1 } })
  await page.keyboard.press('ArrowRight')
  await expect(page.locator('tbody tr.current')).toBeVisible()
  await expect(page.getByRole('button', { name: '실행' })).toBeVisible()
})

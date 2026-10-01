import { expect, test } from '@playwright/test'

test('running a preset plays it through and highlights the current segment', async ({ page }) => {
  await page.goto('./')
  await page.getByLabel('예시 경로').selectOption('isothermal')
  const speed = page.getByRole('button', { name: '재생 속도' })
  for (let i = 0; i < 5 && (await speed.innerText()) !== '4×'; i++) await speed.click()
  await expect(speed).toHaveText('4×')
  await page.getByRole('button', { name: '실행' }).click()
  await expect(page.locator('tbody tr.current')).toBeVisible()
  await expect(page.locator('tbody tr.current')).toHaveCount(1)
  await expect(page.getByText('재생 완료')).toBeVisible({ timeout: 5000 })
  await expect(page.getByRole('button', { name: '실행' })).toBeVisible()
})

test('scrubbing pauses and moves the playhead', async ({ page }) => {
  await page.goto('./')
  await page.getByLabel('예시 경로').selectOption('carnot')
  await page.getByLabel('재생 위치').fill('625')
  await expect(page.locator('.why-proc')).toContainText('등온 과정')
  await expect(page.getByRole('button', { name: '실행' })).toBeVisible()
})

test('a paused or scrubbed playhead still says which way heat goes', async ({ page }) => {
  await page.goto('./')
  await page.getByLabel('예시 경로').selectOption('carnot')
  const chip = page.locator('.why-heat')
  // Carnot: A→B isothermal absorbs, B→C adiabatic, C→D isothermal rejects, D→A adiabatic.
  const expected = ['열 받음', '열 출입 없음', '열 잃음', '열 출입 없음']
  for (const f of [0.03, 0.12, 0.2, 0.31, 0.4, 0.49, 0.51, 0.6, 0.74, 0.76, 0.9, 0.99]) {
    await page.getByLabel('재생 위치').fill(String(Math.round(f * 1000)))
    await expect(chip).toContainText(expected[Math.floor(f * 4)])
  }
})

test('the state line under the scene matches the table at segment ends', async ({ page }) => {
  await page.goto('./')
  await page.getByLabel('예시 경로').selectOption('carnot')
  const rows = page.locator('tbody tr')
  for (let i = 1; i <= 3; i++) {
    // The playhead at i/4 sits exactly on the end of segment i.
    await page.getByLabel('재생 위치').fill(String(i * 250))
    const cells = rows.nth(i - 1).locator('td')
    const end = async (col: number) =>
      ((await cells.nth(col).innerText()).split('→')[1] ?? '').trim()
    const [V, P, T] = [await end(2), await end(3), await end(4)]
    const line = page.locator('.hud-state')
    await expect(line).toContainText(`P ${P} kPa`)
    await expect(line).toContainText(`V ${V} L`)
    await expect(line).toContainText(`T ${T} K`)
  }
})

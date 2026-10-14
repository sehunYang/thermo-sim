import { expect, test } from '@playwright/test'

test('full screen shows only the graph, the scene and the playbar, and Esc leaves it', async ({
  page,
}) => {
  await page.goto('./')
  await page.getByLabel('예시 경로').selectOption('carnot')
  await page.getByRole('button', { name: '전체 화면' }).click()

  await expect(page.locator('.app.full')).toBeVisible()
  await expect(page.locator('.appbar')).toBeHidden()
  await expect(page.locator('.panel')).toBeHidden()
  const graph = page.locator('.graph-pane')
  const scene = page.locator('.engine-pane')
  await expect(graph).toBeVisible()
  await expect(scene).toBeVisible()
  await expect(page.getByRole('button', { name: /실행/ })).toBeVisible()

  // Nothing scrolls: the three pieces fit the screen.
  const vp = page.viewportSize()!
  const bar = (await page.locator('.playbar').boundingBox())!
  expect(bar.y + bar.height).toBeLessThanOrEqual(vp.height + 1)
  const g = (await graph.boundingBox())!
  const s = (await scene.boundingBox())!
  if (vp.width > vp.height) expect(s.x).toBeGreaterThanOrEqual(g.x + g.width - 1)
  else expect(s.y).toBeGreaterThanOrEqual(g.y + g.height - 1)

  await page.keyboard.press('Escape')
  await expect(page.locator('.app.full')).toHaveCount(0)
  await expect(page.locator('.appbar')).toBeVisible()
})

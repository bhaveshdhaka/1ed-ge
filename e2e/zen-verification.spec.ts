import { test, expect } from './fixtures/zen'

const DATE = '2099-12-30'

test('unauthenticated zen and routine API are protected', async ({ page }) => {
  await page.goto('/api/admin/routines?date=' + DATE)
  expect(page.url()).toMatch(/\/api\/admin\/routines/)
  expect(await page.locator('body').textContent()).toContain('unauthorized')
})

test('authenticated zen exposes routines and persists a completion', async ({ zen: page }) => {
  await page.getByRole('button', { name: /2 day/ }).click()
  await expect(page.getByText('routines')).toBeVisible()
  const save = await page.request.post('/api/admin/routines', { data: { activity: 'nature' } })
  expect(save.ok()).toBe(true)
  await expect.poll(async () => {
    const response = await page.request.get('/api/admin/routines')
    const body = await response.json()
    return body.records.some((record: { activity: string }) => record.activity === 'nature')
  }, { timeout: 10000 }).toBe(true)
})

test('authenticated zen does not overflow a 393px viewport', async ({ zen: page }) => {
  await page.setViewportSize({ width: 393, height: 852 })
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(1)
})

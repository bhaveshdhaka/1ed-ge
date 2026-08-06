import { test, expect } from '@playwright/test'

test.describe('cockpit — day page', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
  })

  test('day page renders the timeline, rails and writing doc', async ({ page }) => {
    await page.goto('/day/13-aug-2026')
    await expect(page.locator('[data-timeline]')).toHaveCount(1)
    await expect(page.locator('[data-band]').first()).toBeVisible()
    await expect(page.locator('[data-rail-l]').first()).toBeVisible()
    await expect(page.locator('[data-rail-r]').first()).toBeVisible()
    await expect(page.locator('[data-doc]')).toHaveCount(1)
  })

  test('rules and a quote render in the left rail', async ({ page }) => {
    await page.goto('/day/13-aug-2026')
    await expect(page.locator('[data-rail-l]').locator('text=flat 15 minutes before any scheduled news event.')).toBeVisible()
    await expect(page.locator('[data-rail-l]').locator('.ck-quote').first()).toBeVisible()
  })

  test('no duplicate market info: rails carry no session times', async ({ page }) => {
    await page.goto('/day/13-aug-2026')
    await expect(page.locator('[data-rail-r]').locator('text=NYSE')).toHaveCount(0)
  })
})

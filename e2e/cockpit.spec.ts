import { test, expect } from '@playwright/test'

test.describe('cockpit', () => {
  test('day page timeline exists', async ({ page }) => {
    await page.goto('/day/13-aug-2026')
    await expect(page.locator('[data-timeline]')).toHaveCount(1)
  })
})

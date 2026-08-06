import { test, expect } from '@playwright/test'

const PUBLIC_ROUTES = ['/', '/journal', '/performance', '/tracker', '/trends', '/accounts', '/coach', '/about']

for (const route of PUBLIC_ROUTES) {
  test(`public route ${route} returns 200`, async ({ page }) => {
    const res = await page.goto(route)
    expect(res?.status()).toBe(200)
  })
}

test.describe('home', () => {
  test('day X/730 counter is visible', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('text=/730')).toBeVisible()
  })

  test('zero external JS bundles on public pages', async ({ page }) => {
    await page.goto('/')
    const scripts = await page.locator('script[src]').count()
    expect(scripts).toBe(0)
  })

  test('summit theme is applied (data-theme + background + peak brand)', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'summit')
    await expect(page.locator('.theme-bg')).toHaveCount(1)
    await expect(page.locator('.tb-stars')).toHaveCount(2)
    await expect(page.locator('.tb-mountain')).toHaveCount(1)
    await expect(page.locator('.brand-word')).toBeVisible()
    await expect(page.locator('.hero-fade').first()).toBeVisible()
  })
})

test.describe('navigation', () => {
  test('desktop nav shows all 8 links', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto('/')
    for (const label of ['journal', 'performance', 'tracker', 'trends', 'accounts', 'coach', 'about']) {
      await expect(page.locator(`header nav a[href="/${label}"]`).or(page.locator(`nav a[href="/${label}"]`)).first()).toBeVisible()
    }
  })

  test('mobile shows hamburger and menu opens without JS bundle', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/')
    const summary = page.locator('details summary[aria-label="menu"]')
    await expect(summary).toBeVisible()
    await summary.click()
    await expect(page.locator('details[open] a[href="/about"]')).toBeVisible()
  })
})

test.describe('journal', () => {
  test('SSR search filters entries via ?q=', async ({ page }) => {
    await page.goto('/journal?q=beginning')
    await expect(page.locator('text=Day Zero').first()).toBeVisible()
    const count = await page.locator('text=/\\d+ of \\d+ entries/').count()
    expect(count).toBeGreaterThan(0)
  })

  test('date jump input present', async ({ page }) => {
    await page.goto('/journal')
    await expect(page.locator('input[type="date"]')).toBeVisible()
  })

  test('month grouping renders sticky headers', async ({ page }) => {
    await page.goto('/journal')
    await expect(page.locator('text=aug 2026').first()).toBeVisible()
  })
})

test.describe('performance', () => {
  test('sticky section nav anchors exist', async ({ page }) => {
    await page.goto('/performance')
    for (const id of ['#stats', '#charts', '#accounts', '#recent']) {
      await expect(page.locator(`a[href="${id}"]`)).toBeVisible()
    }
  })
})

test.describe('tracker', () => {
  test('habit heatmaps render', async ({ page }) => {
    await page.goto('/tracker')
    // heatmap SVGs specifically — the nav brand + theme background also render SVGs
    await expect(page.locator('.overflow-x-auto svg')).toHaveCount(6)
  })
})

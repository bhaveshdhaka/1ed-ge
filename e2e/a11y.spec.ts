import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const PUBLIC_ROUTES = ['/', '/journal', '/calendar', '/performance', '/accounts', '/coach', '/about']

for (const route of PUBLIC_ROUTES) {
  test(`a11y: public route ${route} has no critical/serious violations`, async ({ page }) => {
    await page.goto(route)
    const results = await new AxeBuilder({ page }).analyze()
    const bad = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')
    if (bad.length) {
      const summary = bad.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} node(s) — ${v.help}`).join('\n')
      test.info().attach(`violations-${route.replace(/\//g, '_')}`, { body: summary, contentType: 'text/plain' })
    }
    expect(bad, bad.map((v) => v.id).join(', ')).toEqual([])
  })
}

test('a11y: admin day workspace has no critical/serious violations', async ({ page }) => {
  await page.goto(`/zen/${process.env.ADMIN_SECRET ?? ''}`)
  await expect(page.locator('button:has-text("overview")').first()).toBeVisible({ timeout: 20000 })
  await page.keyboard.press('2')
  await expect(page.locator('h1:has-text("/ day")')).toBeVisible()
  const results = await new AxeBuilder({ page }).analyze()
  const bad = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')
  if (bad.length) {
    const summary = bad.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} node(s) — ${v.help}`).join('\n')
    test.info().attach('violations-admin-day', { body: summary, contentType: 'text/plain' })
  }
  expect(bad, bad.map((v) => v.id).join(', ')).toEqual([])
})

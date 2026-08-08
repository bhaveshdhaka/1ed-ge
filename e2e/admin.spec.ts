import { test, expect, type APIRequestContext } from '@playwright/test'
import { writeFileSync } from 'node:fs'

const SECRET = process.env.ADMIN_SECRET ?? ''
const TEST_DATE = '2099-12-31'

// The pending-changes queue is ephemeral (/tmp) and accumulates across sessions;
// count-based assertions ("1 draft change") need a clean slate per test.
test.beforeEach(async () => {
  writeFileSync('/tmp/1edge-pending.json', JSON.stringify([]))
})

// Admin is a React island that hydrates after SSR — wait for the tab bar (React-rendered)
// before pressing keyboard shortcuts, or the keydown handler isn't attached yet.
async function gotoAdmin(page: import('@playwright/test').Page) {
  await page.goto(`/zen/${SECRET}`)
  await expect(page.locator('button:has-text("overview")').first()).toBeVisible({ timeout: 20000 })
}

async function cleanup(request: APIRequestContext) {
  await request.delete('/api/admin/days', { headers: { 'x-admin-secret': SECRET }, data: { date: TEST_DATE } })
  await request.delete('/api/admin/journal', { headers: { 'x-admin-secret': SECRET }, data: { file: `${TEST_DATE}.mdx` } })
}

test.afterEach(async ({ request }) => {
  await cleanup(request)
})

test.describe('admin shell', () => {
  test.beforeEach(async ({ page }) => {
    await gotoAdmin(page)
  })

  test('loads with header, tabs and help overlay', async ({ page }) => {
    await expect(page.locator('text=admin')).toBeVisible()
    for (const tab of ['overview', 'day', 'accounts', 'coach', 'media']) {
      await expect(page.locator(`button:has-text("${tab}")`).first()).toBeVisible()
    }
    await page.keyboard.press('?')
    await expect(page.locator('text=keyboard shortcuts')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.locator('text=keyboard shortcuts')).toHaveCount(0)
  })

  test('keyboard 1-5 switches tabs', async ({ page }) => {
    await page.keyboard.press('2')
    await expect(page.locator('h1:has-text("/ day")')).toBeVisible()
    await page.keyboard.press('3')
    await expect(page.locator('h1:has-text("/ accounts")')).toBeVisible()
    await page.keyboard.press('5')
    await expect(page.locator('h1:has-text("/ media")')).toBeVisible()
  })
})

test.describe('day workspace save flow', () => {
  test('set date, log mood, save, see pending + draft indicator', async ({ page }) => {
    await gotoAdmin(page)
    await page.keyboard.press('2')
    await expect(page.locator('h1:has-text("/ day")')).toBeVisible()

    const dateInput = page.locator('input[type="date"]').first()
    await dateInput.fill(TEST_DATE)
    await dateInput.dispatchEvent('change')
    await expect(page.locator('text=day — 2099-12-31')).toBeVisible()

    // direct-click mood edit
    const moodValue = page.locator('button[title="click to correct"]').filter({ hasText: /\/5|—/ }).first()
    await moodValue.click()
    await page.locator('button.h-10.w-10:has-text("4")').first().click()

    // save
    await page.locator('button:has-text("save")').first().click()
    await expect(page.locator('text=queued for rebuild')).toBeVisible()
    await expect(page.locator('text=● draft saved · not published').first()).toBeVisible({ timeout: 15000 })

    // pending appears in the rebuild bar
    await expect(page.locator('text=1 draft change — not published').first()).toBeVisible({ timeout: 15000 })
  })
})

test.describe('accounts stepper + coach + media', () => {
  test('accounts lifecycle stepper renders', async ({ page }) => {
    await gotoAdmin(page)
    await page.keyboard.press('3')
    await expect(page.locator('button:has-text("eval")').first()).toBeVisible()
    await expect(page.locator('button:has-text("buffer")').first()).toBeVisible()
    await expect(page.locator('button:has-text("payout")').first()).toBeVisible()
  })

  test('coach quick prompts render', async ({ page }) => {
    await gotoAdmin(page)
    await page.keyboard.press('4')
    await expect(page.locator('button:has-text("read the trends")').first()).toBeVisible()
    await expect(page.locator('text=the data f-R-iend sees')).toBeVisible()
  })

  test('media search input renders', async ({ page }) => {
    await gotoAdmin(page)
    await page.keyboard.press('5')
    await expect(page.locator('input[placeholder="search by filename…"]')).toBeVisible()
  })
})

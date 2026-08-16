import { test as base, expect, type BrowserContext, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

export type ZenFixtures = {
  zen: Page
}

/** Install Chromium's isolated virtual authenticator and complete the real UI flow. */
export async function authenticateZen(context: BrowserContext, page: Page) {
  page.setDefaultTimeout(10000)
  page.setDefaultNavigationTimeout(15000)
  // Each test gets a fresh virtual authenticator and a fresh credential store.
  // Never point this at a deployed or developer data directory.
  const profile = process.env.TEST_PROFILE_DIR ?? path.join('.tmp', 'e2e-profile')
  if (!profile.includes('e2e')) throw new Error('refusing to clean non-e2e TEST_PROFILE_DIR')
  fs.rmSync(path.join(profile, 'data', 'passkeys.json'), { force: true })
  fs.rmSync(path.join(profile, 'data', 'sessions.json'), { force: true })
  const cdp = await context.newCDPSession(page)
  await cdp.send('WebAuthn.enable')
  await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      transport: 'internal',
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  })

  await page.goto('/zen/setup?key=e2e-only-setup-key')
  await expect(page.getByRole('button', { name: 'register passkey' })).toBeVisible()
  await page.getByRole('button', { name: 'register passkey' }).click()
  await expect(page.getByText('passkey registered.')).toBeVisible()
  await page.getByRole('link', { name: /open admin/ }).click()
  await expect(page.getByRole('button', { name: 'overview' }).first()).toBeVisible()

  // Exercise login as well as registration: this is the boundary every other
  // authenticated check relies on.
  await context.clearCookies()
  await page.goto('/zen')
  await expect(page.getByRole('button', { name: 'sign in' })).toBeVisible({ timeout: 10000 })
  await page.getByRole('button', { name: 'sign in' }).click({ timeout: 10000, force: true })
  await expect(page.getByRole('button', { name: 'overview' }).first()).toBeVisible({ timeout: 15000 })
  return cdp
}

export const test = base.extend<ZenFixtures>({
  zen: async ({ page }, use) => {
    await authenticateZen(page.context(), page)
    await use(page)
  },
})

export { expect }

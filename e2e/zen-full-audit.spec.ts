import { test, expect } from './fixtures/zen'
import { test as plain, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

// Brief asks for parallel. Inert under the repo's workers:1 config (parallel
// mode only kicks in with multiple workers).
// shortcut: parallel becomes UNSAFE if workers are ever raised — every test
// shares .tmp/e2e-profile (passkeys/sessions/pending files race between
// tests). Give each worker its own TEST_PROFILE_DIR before raising workers.
test.describe.configure({ mode: 'parallel' })

const DATE = '2099-12-30' // future HKT Wednesday — no accountability interference
const PROFILE = path.join(process.cwd(), '.tmp', 'e2e-profile')
const CONTENT = path.join(PROFILE, 'content')
const ROUTINES_DIR = path.join(CONTENT, 'private', 'routines')
const DATA = path.join(PROFILE, 'data')

function todayHkt(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Hong_Kong' }).format(new Date())
}

/** Remove every artefact this suite creates so tests are order-independent. */
function cleanupTestData() {
  if (!PROFILE.includes('e2e-profile')) return // never touch a real profile
  for (const d of new Set([DATE, todayHkt()])) {
    fs.rmSync(path.join(CONTENT, 'days', `${d}.md`), { force: true })
    fs.rmSync(path.join(CONTENT, 'journal', `${d}.mdx`), { force: true })
  }
  if (fs.existsSync(ROUTINES_DIR)) {
    for (const f of fs.readdirSync(ROUTINES_DIR)) {
      if (f.endsWith('.md') && (f.startsWith(DATE) || f.startsWith(todayHkt()))) {
        fs.rmSync(path.join(ROUTINES_DIR, f), { force: true })
      }
    }
  }
  fs.rmSync(path.join(DATA, 'pending.json'), { force: true })
  fs.rmSync(path.join(DATA, 'rebuilds.json'), { force: true })
}

test.beforeEach(cleanupTestData)
test.afterEach(cleanupTestData)

const nav = (page: Page) => page.getByRole('navigation', { name: 'admin tabs' })
const heading = (page: Page, name: string) => page.getByRole('heading', { name, exact: true })

async function openDayAt(page: Page, date: string) {
  await nav(page).getByRole('button', { name: 'day' }).click()
  const input = page.getByLabel('day date')
  await input.fill(date)
  await input.dispatchEvent('change')
  await expect(input).toHaveValue(date)
  await expect(page.getByText(/30-DEC-2099/)).toBeVisible()
  // wait for the routines panel + workspace loads to settle before interacting
  await expect(page.getByText('loading…')).toHaveCount(0)
}

test.describe('authentication flow', () => {
  /** Install the virtual authenticator + register a passkey (registration half of the zen fixture). */
  async function registerPasskey(page: Page) {
    fs.rmSync(path.join(DATA, 'passkeys.json'), { force: true })
    fs.rmSync(path.join(DATA, 'sessions.json'), { force: true })
    const cdp = await page.context().newCDPSession(page)
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
  }

  test('registers a passkey via /zen/setup', async ({ page }) => {
    await registerPasskey(page)
    await page.getByRole('link', { name: /open admin/ }).click()
    await expect(page.getByRole('button', { name: 'overview' }).first()).toBeVisible()
  })

  test('signs in via /zen with the registered passkey', async ({ page }) => {
    await registerPasskey(page)
    await page.context().clearCookies()
    await page.goto('/zen')
    await expect(page.getByRole('button', { name: 'sign in' })).toBeVisible()
    await page.getByRole('button', { name: 'sign in' }).click({ force: true })
    await expect(page.getByRole('button', { name: 'overview' }).first()).toBeVisible()
    // authenticated state also unlocks the protected API
    const res = await page.request.get('/api/admin/routines')
    expect(res.ok()).toBe(true)
  })

  test('authenticated state shows the routines panel', async ({ zen: page }) => {
    await nav(page).getByRole('button', { name: 'day' }).click()
    await expect(heading(page, '/ day')).toBeVisible()
    await expect(page.getByRole('button', { name: /nature/ })).toBeVisible()
  })
})

test.describe('tab navigation', () => {
  test('every tab button loads its panel', async ({ zen: page }) => {
    const tabs: [string, string][] = [
      ['overview', '/ overview'],
      ['day', '/ day'],
      ['accounts', '/ accounts'],
      ['coach', '/ coach'],
      ['media', '/ media'],
    ]
    for (const [label, h] of tabs) {
      await nav(page).getByRole('button', { name: label }).click()
      await expect(heading(page, h)).toBeVisible()
    }
  })

  test('keyboard shortcuts 1-5 switch tabs', async ({ zen: page }) => {
    for (const [key, h] of [
      ['2', '/ day'],
      ['3', '/ accounts'],
      ['4', '/ coach'],
      ['5', '/ media'],
      ['1', '/ overview'],
    ] as [string, string][]) {
      await page.keyboard.press(key)
      await expect(heading(page, h)).toBeVisible()
    }
  })
})

test.describe('routines panel', () => {
  test('renders the panel with every routine activity', async ({ zen: page }) => {
    await openDayAt(page, DATE)
    await expect(page.getByText('routines')).toBeVisible()
    for (const label of ['quiet', 'nature', 'exercise', 'intentions', 're-wiring', '21 days', 'mind movie']) {
      await expect(page.getByRole('button', { name: new RegExp(label) })).toBeVisible()
    }
    await expect(page.getByText('0/6')).toBeVisible()
  })

  test('adds a new routine activity via the API', async ({ zen: page }) => {
    const res = await page.request.post('/api/admin/routines', { data: { activity: 'exercise', date: DATE } })
    expect(res.ok()).toBe(true)
    await expect
      .poll(async () => {
        const body = await (await page.request.get('/api/admin/routines?date=' + DATE)).json()
        return body.records.some(
          (r: { activity: string; date: string }) => r.activity === 'exercise' && r.date === DATE,
        )
      })
      .toBe(true)
  })

  test('marks a routine complete in the UI and it survives a reload', async ({ zen: page }) => {
    await openDayAt(page, DATE)
    const nature = page.getByRole('button', { name: /nature/ })
    await nature.click()
    await expect(nature).toHaveClass(/border-accent/)
    await expect(page.getByText('1/6')).toBeVisible()
    // persistence: re-open the same day after a full reload (session cookie survives)
    await page.reload()
    await openDayAt(page, DATE)
    await expect(page.getByRole('button', { name: /nature/ })).toHaveClass(/border-accent/)
    await expect(page.getByText('1/6')).toBeVisible()
  })
})

test.describe('day workspace', () => {
  test('set date, log mood, save, see draft + pending indicators', async ({ zen: page }) => {
    await openDayAt(page, DATE)

    // log mood 4/5 through the same save endpoint the workspace uses
    const save = await page.request.post('/api/admin/days', { data: { date: DATE, mood: 4 } })
    expect(save.ok()).toBe(true)
    await expect
      .poll(async () => {
        const body = await (await page.request.get('/api/admin/days?date=' + DATE)).json()
        return body.day?.mood === 4
      })
      .toBe(true)

    // reflection draft → draft indicator in the thoughts card
    await page.getByRole('button', { name: 'reflection', exact: true }).click()
    await page.getByLabel('reflection draft').fill('e2e audit — end of day reflection for 2099-12-30')
    await expect(page.getByText(/· 1 draft/)).toBeVisible()
    await expect(page.getByText('draft · not published')).toBeVisible()

    // publish → saved, and a pending change is queued for the rebuild
    await page.getByRole('button', { name: /publish reflection/ }).click()
    await expect(page.getByText(/published to \/journal/)).toBeVisible()
    await expect
      .poll(async () => {
        const body = await (await page.request.get('/api/admin/rebuild')).json()
        return (body.pending ?? []).length >= 1
      })
      .toBe(true)
    await page.getByRole('button', { name: 'notifications' }).click()
    const rebuild = page.getByText('rebuild to publish')
    await expect(rebuild).toBeVisible()
    await expect(rebuild).toBeEnabled()
  })
})

test.describe('accounts tab', () => {
  test('lifecycle stepper renders for every account', async ({ zen: page }) => {
    await nav(page).getByRole('button', { name: 'accounts' }).click()
    await expect(heading(page, '/ accounts')).toBeVisible()
    for (const stage of ['eval', 'funded', 'buffer', 'payout', 'failed', 'paused']) {
      await expect(page.getByRole('button', { name: stage, exact: true }).first()).toBeVisible()
    }
    await expect(page.getByText("clicking a stage records it in the history with today's date").first()).toBeVisible()
  })
})

test.describe('coach tab', () => {
  test('quick prompts and composer render', async ({ zen: page }) => {
    await nav(page).getByRole('button', { name: 'coach' }).click()
    await expect(heading(page, '/ coach')).toBeVisible()
    for (const prompt of [
      'read the trends and give me the honest picture',
      'call me out — what am I fooling myself about?',
      'what should I work on tomorrow?',
      'what have I done well recently?',
      'is my screen time hurting my results?',
    ]) {
      await expect(page.getByRole('button', { name: prompt })).toBeVisible()
    }
    await expect(page.getByText('data f-R-iend sees')).toBeVisible()
    await expect(page.getByPlaceholder('say something — the coach will read the current trends and answer…')).toBeVisible()
    await expect(page.getByRole('button', { name: 'send' })).toBeVisible()
  })
})

test.describe('media tab', () => {
  test('search input renders and filters to no matches', async ({ zen: page }) => {
    await nav(page).getByRole('button', { name: 'media' }).click()
    await expect(heading(page, '/ media')).toBeVisible()
    const search = page.getByPlaceholder('search by filename…')
    await expect(search).toBeVisible()
    await search.fill('zzz-no-such-file')
    await expect(page.getByText('no matches')).toBeVisible()
  })
})

test.describe('API validation', () => {
  plain('unauthenticated routines GET is rejected', async ({ request }) => {
    const res = await request.get('/api/admin/routines?date=' + DATE)
    expect(res.status()).toBe(401)
    expect(await res.text()).toContain('unauthorized')
  })

  plain('unauthenticated routines POST is rejected', async ({ request }) => {
    const res = await request.post('/api/admin/routines', { data: { activity: 'nature' } })
    expect(res.status()).toBe(401)
    expect(await res.text()).toContain('unauthorized')
  })

  test('authenticated routines GET returns data', async ({ zen: page }) => {
    const res = await page.request.get('/api/admin/routines?date=' + DATE)
    expect(res.ok()).toBe(true)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(Array.isArray(body.records)).toBe(true)
  })

  test('authenticated routines POST persists', async ({ zen: page }) => {
    const res = await page.request.post('/api/admin/routines', { data: { activity: 'intentions', date: DATE } })
    expect(res.ok()).toBe(true)
    await expect
      .poll(async () => {
        const body = await (await page.request.get('/api/admin/routines?date=' + DATE)).json()
        return body.records.some((r: { activity: string }) => r.activity === 'intentions')
      })
      .toBe(true)
  })
})

test.describe('mobile 393px viewport', () => {
  test.skip(({ isMobile }) => !isMobile, 'mobile-only flow')

  test('tabs, routines, and coach/media are clickable without overflow', async ({ zen: page }) => {
    await page.setViewportSize({ width: 393, height: 852 })
    const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)

    expect(await overflow()).toBeLessThanOrEqual(1)
    for (const [label, h] of [
      ['overview', '/ overview'],
      ['day', '/ day'],
      ['accounts', '/ accounts'],
      ['coach', '/ coach'],
      ['media', '/ media'],
    ] as [string, string][]) {
      await nav(page).getByRole('button', { name: label }).click()
      await expect(heading(page, h)).toBeVisible()
      expect(await overflow()).toBeLessThanOrEqual(1)
    }

    // routines panel works on mobile (today's date is the day-tab default)
    await nav(page).getByRole('button', { name: 'day' }).click()
    const exercise = page.getByRole('button', { name: /exercise/ })
    await expect(exercise).toBeVisible()
    await exercise.click()
    await expect(exercise).toHaveClass(/border-accent/)
    expect(await overflow()).toBeLessThanOrEqual(1)

    // coach quick prompts + media search are reachable and clickable
    await nav(page).getByRole('button', { name: 'coach' }).click()
    await expect(page.getByRole('button', { name: /read the trends/ })).toBeVisible()
    await nav(page).getByRole('button', { name: 'media' }).click()
    await expect(page.getByPlaceholder('search by filename…')).toBeVisible()
    expect(await overflow()).toBeLessThanOrEqual(1)
  })

  test('full day save flow on 393px', async ({ zen: page }) => {
    await page.setViewportSize({ width: 393, height: 852 })
    const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)

    await openDayAt(page, DATE)
    const save = await page.request.post('/api/admin/days', { data: { date: DATE, mood: 5 } })
    expect(save.ok()).toBe(true)

    await page.getByRole('button', { name: 'reflection', exact: true }).click()
    await page.getByLabel('reflection draft').fill('mobile e2e reflection')
    await expect(page.getByText('draft · not published')).toBeVisible()

    await page.getByRole('button', { name: /publish reflection/ }).click()
    await expect(page.getByText(/published to \/journal/)).toBeVisible()

    await page.getByRole('button', { name: 'notifications' }).click()
    await expect(page.getByText('rebuild to publish')).toBeVisible()
    expect(await overflow()).toBeLessThanOrEqual(1)
  })
})
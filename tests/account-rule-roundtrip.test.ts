import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import matter from 'gray-matter'

// Scratch passkey session store + env before importing modules that read env at load.
const tmpData = fs.mkdtempSync(path.join(os.tmpdir(), '1edge-account-roundtrip-'))
process.env.PASSKEY_DATA_DIR = tmpData
process.env.ADMIN_SECRET = 'test-secret'
process.env.SITE_URL = 'http://localhost:4321'
process.env.SITE_ENV = 'test'
process.env.OPENROUTER_API_KEY = 'sk-test-dummy'

const { saveSession } = await import('../src/lib/passkeys')
const { POST } = await import('../src/pages/api/admin/accounts')
const { readEntry } = await import('../src/lib/content')
const { accountRuleStatus } = await import('../src/lib/account-rules')
const { accountSchema } = await import('../src/lib/account-schema')
import type { AccountLike } from '../src/lib/account-rules'

saveSession('test-token-xyz', 24 * 3600 * 1000)

const accountsDir = path.join(process.cwd(), 'src/content/accounts')
// Captain-provided account: LTF05061295040001 (funded, MNQU6) — 50k, $1,200 daily
// loss limit, $2,000 total drawdown, lockout at the DLL, building-buffer stage.
// sanitizeSlug lowercases the id in the write path.
const TEST_ID = 'ltf05061295040001'
const testFile = `${TEST_ID}.md`

const post = (body: unknown, token = 'test-token-xyz') =>
  POST({
    request: new Request('http://localhost/api/admin/accounts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: `zen_session=${token}`,
      },
      body: JSON.stringify(body),
    }),
  } as unknown as Parameters<typeof POST>[0])

const statusOf = (account: unknown) =>
  accountRuleStatus(account as AccountLike, { netPnl: 0, drawdownLimit: 2000, trailing: true }, [], '2026-08-08')

test('admin save writes rules NESTED — never flat — for LTF05061295040001', async () => {
  const res = await post({
    action: 'save',
    id: 'LTF05061295040001',
    firm: 'Lucid',
    size: 50000,
    sizeLabel: '50k',
    drawdownLimit: 2000,
    trailing: true,
    contract: 'MNQU6',
    pointsValue: 2,
    riskPerTrade: 200,
    stage: 'buffer',
    stages: [
      { stage: 'funded', from: '2026-07-01' },
      { stage: 'buffer', from: '2026-08-01' },
    ],
    rules: {
      dailyLossLimit: 1200,
      profitTarget: 3000,
      consistencyPct: 40,
      bufferBalance: 52100,
      drawdownMode: 'eod',
      payoutSplit: 90,
      lockout: true,
    },
  })
  assert.equal(res.status, 200, `expected 200, got ${res.status}`)

  const raw = fs.readFileSync(path.join(accountsDir, testFile), 'utf8')
  assert.match(raw, /^rules:$/m, 'rules must be written as a nested block')
  assert.doesNotMatch(raw, /^dailyLossLimit:/m, 'dailyLossLimit must NOT be a flat top-level field')
  assert.doesNotMatch(raw, /^consistencyPct:/m, 'consistencyPct must NOT be a flat top-level field')
  assert.match(raw, /dailyLossLimit: 1200/, 'nested daily loss limit survives')
  assert.match(raw, /consistencyPct: 40/, 'nested consistency survives')
  assert.match(raw, /lockout: true/, 'lockout survives')
})

test('admin read path: fs frontmatter → accountRuleStatus reports configured', () => {
  const data = readEntry('accounts', testFile).data
  const rules = (data.rules ?? {}) as Record<string, unknown>
  assert.equal(rules.dailyLossLimit, 1200)
  assert.equal(rules.consistencyPct, 40)
  assert.equal(rules.drawdownMode, 'eod')
  assert.equal(rules.lockout, true)

  const s = statusOf(data)
  assert.equal(s.configured, true, 'admin read path must see the account as configured')
  assert.equal(s.dailyLossLimit, 1200)
  assert.equal(s.consistencyPct, 40)
  assert.equal(s.drawdownLimit, 2000)
  assert.equal(s.lockout, true)
  assert.equal(s.breach, 'none')
})

test('public read path: collection schema (zod) → accountRuleStatus reports configured', () => {
  const raw = fs.readFileSync(path.join(accountsDir, testFile), 'utf8')
  // This is exactly what the Astro content collection does: zod-parse frontmatter.
  const parsed = accountSchema.parse(matter(raw).data)

  const s = statusOf(parsed)
  assert.equal(s.configured, true, 'public read path must see the account as configured')
  assert.equal(s.dailyLossLimit, 1200)
  assert.equal(s.consistencyPct, 40)
  assert.equal(s.drawdownLimit, 2000)
  assert.equal(s.lockout, true)
  assert.equal(s.trailing, true) // drawdownMode eod → trailing

  // Lockout semantics: after a DLL day the next day resumes at total − daily.
  assert.equal(parsed.drawdownLimit - (parsed.rules?.dailyLossLimit ?? 0), 800)
})

test('checked-in account files are canonical: nested rules parse + report configured (no destructive change)', () => {
  for (const f of ['lte05061295040002.md', 'lte05061295040003.md']) {
    const raw = fs.readFileSync(path.join(accountsDir, f), 'utf8')
    assert.doesNotMatch(raw, /^dailyLossLimit:/m, `${f} rules must be nested`)
    const parsed = accountSchema.parse(matter(raw).data)
    const s = statusOf(parsed)
    assert.equal(s.configured, true, `${f} must stay configured`)
    assert.equal(s.dailyLossLimit, 1200)
    assert.equal(s.consistencyPct, 40)
    assert.equal(s.drawdownLimit, 2000)
  }
})

after(() => {
  const f = path.join(accountsDir, testFile)
  if (fs.existsSync(f)) fs.unlinkSync(f)
})

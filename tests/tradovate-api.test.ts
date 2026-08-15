import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

/**
 * Tradovate API integration — the real admin routes (auth gate + parse +
 * apply + mental-stop) exercised like library-api.test.ts: temp stores for the
 * session, the pending-changes queue, and the content tree. Uses the captain's
 * actual sample exports.
 */

const tmpData = fs.mkdtempSync(path.join(os.tmpdir(), '1edge-tradovate-api-'))
process.env.PASSKEY_DATA_DIR = tmpData
process.env.DATA_DIR = path.join(tmpData, 'data')
process.env.DATA_PATH = path.join(tmpData, 'content')
process.env.ADMIN_SECRET = 'test-secret'
process.env.SITE_URL = 'http://localhost:4321'
process.env.SITE_ENV = 'test'
process.env.OPENROUTER_API_KEY = 'sk-test-dummy'

const { saveSession } = await import('../src/lib/passkeys')
const { writeEntry } = await import('../src/lib/content')
// a minimal account the apply endpoint can link the platform id onto
writeEntry('accounts', 'lucid-50k-a.md', {
  id: 'lucid-50k-a',
  firm: 'Lucid',
  size: 50000,
  sizeLabel: '50k',
  drawdownLimit: 2000,
  trailing: true,
  contract: 'MNQ',
  pointsValue: 2,
  riskPerTrade: 200,
  stage: 'eval',
  platformIds: [],
})
const parseApi = await import('../src/pages/api/admin/tradovate')
const applyApi = await import('../src/pages/api/admin/tradovate/apply')
const mentalApi = await import('../src/pages/api/admin/tradovate/mental-stop')
const daysApi = await import('../src/pages/api/admin/days')
saveSession('test-token-xyz', 24 * 3600 * 1000)

const DIR = '/root/tradovate-reports'
const hasDemo = fs.existsSync(`${DIR}/Performance (7).csv`) && fs.existsSync(`${DIR}/Position History.csv`) && fs.existsSync(`${DIR}/Orders (9).csv`)

const dataUrl = (f: string) => `data:text/csv;base64,${fs.readFileSync(path.join(DIR, f)).toString('base64')}`

const post = (handler: { POST: unknown }, body: unknown, token = 'test-token-xyz') =>
  (handler.POST as (r: Request) => Promise<Response>)({
    request: new Request('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: `zen_session=${token}` },
      body: JSON.stringify(body),
    }),
  } as unknown as Request)

const jsonOf = async (r: Response) => (await r.json()) as Record<string, unknown>

test('tradovate parse → apply → mental-stop → day-save preservation (full HTTP flow)', { skip: !hasDemo && 'sample files absent' }, async () => {
  // --- parse: all 4 files, one export set per account ---
  const parsed = await jsonOf(
    await post(parseApi, {
      files: ['Performance (7).csv', 'Position History.csv', 'Orders (9).csv', 'Cash History.csv'].map((n) => ({
        name: n,
        dataUrl: dataUrl(n),
      })),
      date: '2026-08-14',
    }),
  )
  assert.equal(parsed.ok, true)
  const result = parsed.result as { date: string; trades: { key: string; needsStop: boolean; stop: null; exitType: string }[]; skippedFiles: string[]; aliasProposals: { platformId: string }[] }
  assert.equal(result.date, '2026-08-14')
  assert.equal(result.trades.length, 25)
  assert.deepEqual(result.skippedFiles, ['Cash History.csv'])
  assert.ok(result.trades.every((t) => t.needsStop && t.stop === null))
  assert.ok(result.aliasProposals.some((p) => p.platformId === 'LTF05061295040001'))

  // --- apply: approved batch lands in the day's private draft.tradovate ---
  const trades = (result as { trades: Record<string, unknown>[] }).trades.map((t) => ({ ...t, dup: false }))
  const applied = await jsonOf(
    await post(applyApi, {
      date: '2026-08-14',
      trades,
      platformLinks: [{ platformId: 'LTF05061295040001', internalId: 'lucid-50k-a' }],
    }),
  )
  assert.equal(applied.ok, true)
  assert.equal(applied.imported, 25)

  // the account alias was persisted
  const accountFile = fs.readFileSync(path.join(tmpData, 'content/accounts/lucid-50k-a.md'), 'utf8')
  assert.ok(accountFile.includes('LTF05061295040001'))

  // the day record exists with a private ledger
  const dayFile = fs.readFileSync(path.join(tmpData, 'content/days/2026-08-14.md'), 'utf8')
  assert.ok(dayFile.includes('tradovate'))
  assert.ok(dayFile.includes('620926680030|620926680012'))

  // --- mental-stop: the SL-prompt answer ---
  const ms = await jsonOf(
    await post(mentalApi, { date: '2026-08-14', key: '620926680030|620926680012', mentalStop: 30152 }),
  )
  assert.equal(ms.ok, true)
  assert.equal(ms.needsStop, false)
  const dayAfter = fs.readFileSync(path.join(tmpData, 'content/days/2026-08-14.md'), 'utf8')
  assert.ok(dayAfter.includes('mentalStop: 30152'))

  // --- re-parse: the same files now flag dups (already imported) ---
  const re = await jsonOf(
    await post(parseApi, {
      files: [{ name: 'Position History.csv', dataUrl: dataUrl('Position History.csv') }],
      date: '2026-08-14',
    }),
  )
  assert.equal((re.result as { dupeCount: number }).dupeCount, 25)

  // --- day save: a normal workspace save must not drop the private ledger ---
  const daySave = await jsonOf(
    await post(daysApi, {
      date: '2026-08-14',
      mood: 3,
      trades: [],
      stream: [],
      draft: { reflection: 'kept' },
    }),
  )
  assert.equal(daySave.ok, true)
  const dayAfterSave = fs.readFileSync(path.join(tmpData, 'content/days/2026-08-14.md'), 'utf8')
  assert.ok(dayAfterSave.includes('tradovate'), 'ledger survives a day save')
  assert.ok(dayAfterSave.includes('mentalStop: 30152'), 'the mental SL survives a day save')
})

test('tradovate API refuses without a session', async () => {
  const parsed = await jsonOf(await post(parseApi, { files: [] }, 'no-such-token'))
  assert.equal(parsed.ok, false)
  assert.equal(parsed.error, 'unauthorized')
})

test('apply rejects invalid dates and empty batches', async () => {
  const bad = await jsonOf(await post(applyApi, { date: 'nope', trades: [] }))
  assert.equal(bad.ok, false)
  const empty = await jsonOf(await post(applyApi, { date: '2026-08-14', trades: [] }))
  assert.equal(empty.ok, false)
})

test('cleanup', () => {
  fs.rmSync(tmpData, { recursive: true, force: true })
  assert.ok(!fs.existsSync(tmpData))
})

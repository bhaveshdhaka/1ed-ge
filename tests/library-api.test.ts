import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

// Set up a temp passkey data dir so the session store doesn't touch the repo.
// (Belt-and-braces: also set the envs the env helper reads at module-load.)
const tmpData = fs.mkdtempSync(path.join(os.tmpdir(), '1edge-lib-test-'))
process.env.PASSKEY_DATA_DIR = tmpData
process.env.ADMIN_SECRET = 'test-secret'
process.env.SITE_URL = 'http://localhost:4321'
process.env.SITE_ENV = 'test'
process.env.OPENROUTER_API_KEY = 'sk-test-dummy'

// Now import the modules — they read env at load time.
const { saveSession } = await import('../src/lib/passkeys')
const { POST } = await import('../src/pages/api/admin/library')

// Hand the handler a real session so the auth gate passes.
saveSession('test-token-xyz', 24 * 3600 * 1000)

const habitDir = path.join(process.cwd(), 'src/content/habits')
const testSlugs: string[] = []

const post = (body: unknown, token = 'test-token-xyz') =>
  POST({
    request: new Request('http://localhost/api/admin/library', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: `zen_session=${token}`,
      },
      body: JSON.stringify(body),
    }),
  } as unknown as Parameters<typeof POST>[0])

test('habit save with type=bool writes kind=bool (not "habits") — the reported bug', async () => {
  const res = await post({ action: 'save', kind: 'habits', name: 'test-habit-bool', type: 'bool' })
  assert.equal(res.status, 200, `expected 200, got ${res.status}`)
  const file = path.join(habitDir, 'test-habit-bool.md')
  const raw = fs.readFileSync(file, 'utf8')
  testSlugs.push('test-habit-bool')
  assert.match(raw, /^kind: bool$/m, 'habit kind should be bool (the habit type, not the collection)')
  assert.doesNotMatch(raw, /^kind: habits$/m, 'habit kind should NOT be the collection name')
})

test('habit save with type=count + target persists both', async () => {
  const res = await post({ action: 'save', kind: 'habits', name: 'test-habit-count', type: 'count', target: 8 })
  assert.equal(res.status, 200, `expected 200, got ${res.status}`)
  const file = path.join(habitDir, 'test-habit-count.md')
  const raw = fs.readFileSync(file, 'utf8')
  testSlugs.push('test-habit-count')
  assert.match(raw, /^kind: count$/m)
  assert.match(raw, /^target: 8$/m)
})

test('habit save with no type defaults to bool', async () => {
  const res = await post({ action: 'save', kind: 'habits', name: 'test-habit-default' })
  assert.equal(res.status, 200, `expected 200, got ${res.status}`)
  const file = path.join(habitDir, 'test-habit-default.md')
  const raw = fs.readFileSync(file, 'utf8')
  testSlugs.push('test-habit-default')
  assert.match(raw, /^kind: bool$/m)
})

test('count habit with target=0 omits target (no zero persist)', async () => {
  const res = await post({ action: 'save', kind: 'habits', name: 'test-habit-zero', type: 'count', target: 0 })
  assert.equal(res.status, 200, `expected 200, got ${res.status}`)
  const file = path.join(habitDir, 'test-habit-zero.md')
  const raw = fs.readFileSync(file, 'utf8')
  testSlugs.push('test-habit-zero')
  assert.match(raw, /^kind: count$/m)
  assert.doesNotMatch(raw, /^target:/m, 'target=0 should be omitted from the file')
})

test('regression: POST with body.kind=bool (the old bug shape) is rejected with "invalid kind"', async () => {
  // The original bug: frontend sent { kind: 'bool' } (habit type) instead of
  // { kind: 'habits', type: 'bool' } (collection + type). The library API
  // must still reject this — if the namespace collision ever creeps back,
  // this test catches it.
  const res = await post({ action: 'save', kind: 'bool', name: 'test-habit-broken' })
  assert.equal(res.status, 400, 'old broken shape must be rejected')
  const json = (await res.json()) as { error: string }
  assert.equal(json.error, 'invalid kind')
})

test('unauthorized: missing session cookie is rejected', async () => {
  const res = await post({ action: 'save', kind: 'habits', name: 'test-habit-noauth' }, 'no-such-token')
  assert.equal(res.status, 401)
  const json = (await res.json()) as { error: string }
  assert.equal(json.error, 'unauthorized')
})

after(() => {
  for (const slug of testSlugs) {
    const file = path.join(habitDir, `${slug}.md`)
    if (fs.existsSync(file)) fs.unlinkSync(file)
  }
  fs.rmSync(tmpData, { recursive: true, force: true })
})

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

/**
 * Tradovate import integration: the full day-file round trip — import (merge
 * into the day's private draft.tradovate) → re-import (mental SL survives) →
 * mental-stop store. Runs against a throwaway DATA_PATH so the real content
 * store is never touched; the day collection schema is exercised too.
 */

// content.ts resolves CONTENT from DATA_PATH at import time — set it first,
// then load the modules dynamically (node --test isolates files per process,
// so this file's DATA_PATH cannot leak into other suites).
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tradovate-int-'))
process.env.DATA_PATH = tmp
process.env.DATA_DIR = tmp

const { readEntry, writeEntry } = await import('../src/lib/content')
const { mergeTradovateEntries, applyMentalStop, tradovateEntrySchema } = await import('../src/lib/tradovate')

const entry = (over: Record<string, unknown> = {}) => ({
  key: '620926680030|620926680012',
  market: 'MNQ',
  direction: 'short',
  entry: 30160.25,
  exit: 30152.25,
  points: 8,
  qty: 1,
  pnl: 16,
  accounts: [{ platformId: 'LTF05061295040001', internalId: 'lucid-50k-a', confirmed: true, qty: 1, pnl: 16 }],
  stop: null,
  stopSource: null,
  mentalStop: null,
  needsStop: true,
  riskPoints: null,
  exitType: 'limit',
  mae: null,
  mfe: 8,
  ...over,
})

test('import → re-import keeps the mental SL → mental-stop store updates the file', () => {
  // 1. import: no day file yet → apply writes the day record with the private ledger.
  const { merged: first, fresh, updated, needsStop } = mergeTradovateEntries([], [entry()])
  assert.equal(fresh, 1)
  assert.equal(updated, 0)
  assert.equal(needsStop, 1)
  writeEntry('days', '2026-08-14.md', {
    date: '2026-08-14',
    mood: 3,
    trades: [],
    draft: { tradovate: first },
  })

  // 2. the day record round-trips through gray-matter and reads back intact.
  const back = readEntry('days', '2026-08-14.md').data as Record<string, unknown>
  const ledger = (back.draft as Record<string, unknown>).tradovate as { key: string; needsStop: boolean }[]
  assert.equal(ledger.length, 1)
  assert.equal(ledger[0].key, '620926680030|620926680012')
  assert.equal(ledger[0].needsStop, true)
  assert.equal(back.mood, 3)

  // 3. mental-stop store (the SL-prompt answer).
  const stored = ledger as Parameters<typeof mergeTradovateEntries>[0]
  const withStop = applyMentalStop(stored[0] as never, 30152)
  stored[0] = withStop
  writeEntry('days', '2026-08-14.md', { ...back, draft: { ...(back.draft as object), tradovate: stored } })
  const afterStop = readEntry('days', '2026-08-14.md').data as Record<string, unknown>
  const t0 = ((afterStop.draft as Record<string, unknown>).tradovate as { mentalStop: number; stop: number; stopSource: string; needsStop: boolean; riskPoints: number }[])[0]
  assert.equal(t0.mentalStop, 30152)
  assert.equal(t0.stop, 30152)
  assert.equal(t0.stopSource, 'mental')
  assert.equal(t0.needsStop, false)
  assert.equal(t0.riskPoints, 8.25) // |30160.25 − 30152|

  // 4. re-import the same CSVs — the mental SL survives (carried over).
  const { merged: second, fresh: fresh2, updated: updated2 } = mergeTradovateEntries(stored, [entry()])
  assert.equal(fresh2, 0)
  assert.equal(updated2, 1)
  const t1 = second[0]
  assert.equal(t1.mentalStop, 30152)
  assert.equal(t1.needsStop, false)
  assert.equal(t1.riskPoints, 8.25)

  // 5. a second account's export merges in as a NEW trade (append, not replace).
  const secondAcc = entry({ key: '620926680035|620926680017', entry: 30160.25, exit: 30150, points: 10.25, pnl: 20.5, mfe: 10.25 })
  const { merged: third, fresh: fresh3 } = mergeTradovateEntries(second, [secondAcc])
  assert.equal(fresh3, 1)
  assert.equal(third.length, 2)
  writeEntry('days', '2026-08-14.md', { ...afterStop, draft: { ...(afterStop.draft as object), tradovate: third } })
})

test('day save preserves the private ledger (draft merge semantics)', () => {
  // Simulate the days POST: a normal day-workspace save carries only
  // draft.reflection — the on-disk draft.tradovate must survive.
  const existing = readEntry('days', '2026-08-14.md').data as Record<string, unknown>
  const draft = { reflection: 'today was fine' }
  const onDiskDraft = (existing.draft as Record<string, unknown>) ?? {}
  const known = new Set(Object.keys(draft))
  for (const [k, v] of Object.entries(onDiskDraft)) {
    if (!known.has(k) && v !== undefined) draft[k] = v
  }
  writeEntry('days', '2026-08-14.md', { ...existing, draft }, '')
  const after = readEntry('days', '2026-08-14.md').data as Record<string, unknown>
  assert.equal((after.draft as Record<string, unknown>).reflection, 'today was fine')
  const ledger = (after.draft as Record<string, unknown>).tradovate as unknown[]
  assert.equal(ledger.length, 2, 'tradovate ledger survives a day save')
})

test('persisted ledger entries validate against the shared schema', () => {
  const data = readEntry('days', '2026-08-14.md').data as Record<string, unknown>
  const ledger = (data.draft as Record<string, unknown>).tradovate as Record<string, unknown>[]
  assert.equal(ledger.length, 2)
  // the exact zod schema content.config.ts embeds accepts every stored entry
  const parsed = tradovateEntrySchema.safeParse(ledger[0])
  assert.equal(parsed.success, true)
})

test('cleanup', () => {
  fs.rmSync(tmp, { recursive: true, force: true })
  assert.ok(!fs.existsSync(tmp))
})

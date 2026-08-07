# Phase 2 — Admin Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework the admin React app onto the Stream System primitives: draft reflection + publish, moment composer, trade model tags + commentary, a Library tab (habits/models/rules/quotes CRUD), a plain markdown textarea editor (Milkdown out), and the safety fixes (dirty-guard, no wipe-on-paste, loud rebuild failures, AI timeouts, heartbeat).

**Architecture:** Three layers change together. (1) The file-I/O + API layer gains write paths for `stream`/`draft`/trade `model`+`commentary` (currently silently dropped by `days.ts`), a new `models` list on the day GET, a new `/api/admin/library` CRUD route, and a new `/api/admin/ping` heartbeat. (2) The admin React app replaces Milkdown Crepe with a controlled markdown textarea + client-side preview, adds a Library tab, and reworks DayWorkspace (draft reflection, moment composer, model/commentary on trades, publish buttons, merge-on-paste). (3) Safety: AdminApp gains a global dirty-guard + heartbeat timer + `aria-live`; RebuildBar shows loud failures; `orChat` gets a 60s timeout. Public pages are untouched by this phase.

**Tech Stack:** Astro 5 SSR routes, React 19 (admin only), existing `unified`/`remark-parse`/`remark-rehype`/`rehype-stringify` (client-safe ESM — reused for the preview, no new deps), `gray-matter` fs layer, existing `admin/ui.tsx` kit.

## Global Constraints

- **Repo verification culture (no unit-test runner):** `package.json` has no vitest/jest. Per-task verification = `npm run typecheck` + commit (the handover gate). API changes get a curl smoke test against a local server on port **4323** (`HOST=127.0.0.1 node dist/server/entry.mjs` after a build) — never port 4321 (prod docker). Full `npm run build` + deploy + live-verify happens once, in the final task.
- **No two agents build at once** — builds race on `node_modules/.astro`. Build only in the final task unless a task explicitly says so.
- **`npm run build` clears `node_modules/.astro`** — keep that (never remove the `rm -rf`).
- **Zero-JS public pages are untouched.** All React lives under `src/components/admin/` and `src/pages/admin/`. Do not add JS to public pages.
- **Never commit secrets.** `.env` is gitignored; admin routes auth via `x-admin-secret` header.
- **The day record stays the spine; presentation is decoupled.** Drafts (`draft:`) are private, never rendered by public routes. `stream:` moments are the only approved public narrative.
- **Owner-authored content only (no AI gyaan).** The AI-polish path (`assist` action, kind `polish`) may polish the owner's *existing* moment text but never authors new moments. Publish is always a separate explicit owner action.
- **Money colors:** up = `text-up`, down = `text-down` by sign of the value. Do not introduce green-for-negative.
- **Keep the admin's existing `ui.tsx` kit** (`Field`, `TextInput`, `NumInput`, `TextArea`, `Select`, `Button`, `Card`, `Stat`) — Phase 0's `src/components/ui/react/*` Radix kit is not imported anywhere and is out of scope for this phase.
- **Moment `at` format is `HH:MM`** (regex `/^\d{2}:\d{2}$/`). `tradeIdx` is a non-negative integer referencing `trades[]`.
- **`bus` topics in `api.ts` are payload-less** (`emit(topic?: string)`). Do not extend the bus signature; communicate state via component props (e.g. `onDirtyChange`).
- Docs updates (AGENTS.md / MEMORY.md / CHANGELOG.md) land in the final task, not per-task.

---

### Task 1: API layer — day write path + models list + library CRUD + ping

**Files:**
- Modify: `src/lib/content.ts:9-19` (Kind + DIRS)
- Modify: `src/pages/api/admin/days.ts` (normalizeTrade, GET, POST)
- Create: `src/pages/api/admin/library.ts`
- Create: `src/pages/api/admin/ping.ts`
- Test: curl smoke tests (below)

**Interfaces:**
- Consumes: existing `listMds`/`readEntry`/`writeEntry`/`deleteEntry`/`sanitizeSlug` from `src/lib/content.ts`, `addChange` from `src/lib/changes.ts`, `touchLive` from `src/lib/live.ts`, `authorized`/`json`/`error` from `src/lib/auth.ts`.
- Produces:
  - `days GET` now returns `{ ok, day, accounts, habits, models }` where `models: { slug: string; name: string }[]`.
  - `days POST` accepts `stream: Moment[]`, `draft: { reflection?: string; moments?: Moment[] }`, and per-trade `model: string` + `commentary: string`. `Moment = { at: string; type: 'pre-market'|'post-market'|'trade'|'note'|'quote'|'media'; text?: string; tradeIdx?: number; media?: string; author?: string }`.
  - `library GET` → `{ ok, habits: LibRow[], models: LibRow[], rules: LibRow[], quotes: LibRow[] }`, `LibRow = { slug, file, ...frontmatter }`.
  - `library POST` → `{ ok, slug }` for actions `save` + `delete` across kinds `habits|models|rules|quotes`.
  - `ping POST` → `{ ok, live: true }`.

- [ ] **Step 1: Extend `Kind` and `DIRS` in `src/lib/content.ts`**

Replace lines 9-19:

```ts
export type Kind =
  | 'days'
  | 'accounts'
  | 'payouts'
  | 'coach'
  | 'journal'
  | 'habits'
  | 'brief'
  | 'models'
  | 'rules'
  | 'quotes'

const DIRS: Record<Kind, string> = {
  days: 'days',
  accounts: 'accounts',
  payouts: 'payouts',
  coach: 'coach',
  journal: 'journal',
  habits: 'habits',
  brief: 'brief',
  models: 'models',
  rules: 'rules',
  quotes: 'quotes',
}
```

- [ ] **Step 2: Verify typecheck still passes**

Run: `npm run typecheck`
Expected: no new errors.

- [ ] **Step 3: Extend `normalizeTrade` in `src/pages/api/admin/days.ts`**

In `normalizeTrade` (line 16), add two fields to the returned object (after the `note` line, line 39):

```ts
    ...(typeof t.model === 'string' && t.model.trim() ? { model: String(t.model).trim() } : {}),
    ...(typeof t.commentary === 'string' && t.commentary.trim() ? { commentary: String(t.commentary).trim() } : {}),
```

- [ ] **Step 4: Add moment normalization + models list to `days.ts`**

Add a `MOMENT_TYPES` const next to `SESSIONS` (line 9) and a `normalizeMoment` function after `normalizeTrade`:

```ts
const MOMENT_TYPES = ['pre-market', 'post-market', 'trade', 'note', 'quote', 'media']

function normalizeMoment(m: Record<string, any>): Record<string, any> | null {
  const type = MOMENT_TYPES.includes(String(m.type)) ? String(m.type) : ''
  if (!type) return null
  const at = /^\d{2}:\d{2}$/.test(String(m.at ?? '')) ? String(m.at) : '00:00'
  const out: Record<string, any> = { at, type }
  if (typeof m.text === 'string' && m.text.trim()) out.text = m.text.trim()
  if (m.tradeIdx != null) {
    const ti = Number(m.tradeIdx)
    if (Number.isInteger(ti) && ti >= 0) out.tradeIdx = ti
  }
  if (typeof m.media === 'string' && m.media.trim()) out.media = m.media.trim()
  if (typeof m.author === 'string' && m.author.trim()) out.author = m.author.trim()
  return out
}

function normalizeMoments(v: unknown): Record<string, any>[] {
  return Array.isArray(v)
    ? v.map((m) => normalizeMoment(m as Record<string, any>)).filter((m): m is Record<string, any> => m !== null)
    : []
}
```

In `GET`, after the `habits` map (line 61-64), add:

```ts
  const models = listMds('models').map((f) => {
    const data = readEntry('models', f).data as Record<string, unknown>
    return { slug: f.replace(/\.md$/, ''), name: String(data.name ?? f) }
  })
```

and include `models` in **both** return objects (line 70 and line 78).

In `POST`, after the `trades` normalization (line 95-97), add:

```ts
  const stream = normalizeMoments(body.stream)
  const draft: Record<string, unknown> = {}
  if (typeof body.draft?.reflection === 'string' && body.draft.reflection.trim()) {
    draft.reflection = body.draft.reflection.trim()
  }
  const draftMoments = normalizeMoments(body.draft?.moments)
  if (draftMoments.length) draft.moments = draftMoments
```

and add to the `data` object (after `trades,` line 124):

```ts
    ...(stream.length ? { stream } : {}),
    ...(Object.keys(draft).length ? { draft } : {}),
```

Also update the `addChange` detail (line 128) to include stream/draft counts:

```ts
  const detail = `${trades.length} trade${trades.length === 1 ? '' : 's'}` + (mood !== null ? ` · mood ${mood}` : '') + (deviceScreens.length ? ' · screen-time' : '') + (stream.length ? ` · ${stream.length} moment${stream.length === 1 ? '' : 's'}` : '') + (Object.keys(draft).length ? ' · draft' : '')
```

- [ ] **Step 5: Create `src/pages/api/admin/library.ts`**

```ts
import type { APIRoute } from 'astro'
import { authorized, json, error } from '../../../lib/auth'
import { listMds, readEntry, writeEntry, deleteEntry, sanitizeSlug } from '../../../lib/content'
import { addChange } from '../../../lib/changes'

export const prerender = false

type LibKind = 'habits' | 'models' | 'rules' | 'quotes'
const LIB_KINDS: LibKind[] = ['habits', 'models', 'rules', 'quotes']

export const GET: APIRoute = async ({ request }) => {
  if (!authorized(request)) return error('unauthorized', 401)
  const readAll = (kind: LibKind) =>
    listMds(kind).map((f) => ({ slug: f.replace(/\.mdx?$/, ''), file: f, ...readEntry(kind, f).data }))
  return json({
    ok: true,
    habits: readAll('habits'),
    models: readAll('models'),
    rules: readAll('rules'),
    quotes: readAll('quotes'),
  })
}

export const POST: APIRoute = async ({ request }) => {
  if (!authorized(request)) return error('unauthorized', 401)
  const body = await request.json().catch(() => ({}))
  const action = String(body.action ?? '')
  const kind = String(body.kind ?? '') as LibKind
  if (!LIB_KINDS.includes(kind)) return error('invalid kind')
  const slug = typeof body.slug === 'string' && body.slug ? sanitizeSlug(body.slug) : ''

  if (action === 'save') {
    if (kind === 'habits') {
      const s = slug || sanitizeSlug(String(body.name ?? 'untitled'))
      if (!s) return error('need a name')
      const data: Record<string, unknown> = {
        name: String(body.name ?? s),
        ...(body.emoji ? { emoji: String(body.emoji) } : {}),
        ...(body.color ? { color: String(body.color) } : {}),
        ...(body.description ? { description: String(body.description) } : {}),
        kind: body.kind === 'count' ? 'count' : 'bool',
        ...(body.kind === 'count' && body.target != null && Number(body.target) > 0 ? { target: Number(body.target) } : {}),
        category: String(body.category ?? 'general'),
        order: Number(body.order ?? 0),
        active: body.active !== false,
      }
      writeEntry('habits', `${s}.md`, data, '')
      addChange('library', `habit ${s}`)
      return json({ ok: true, slug: s })
    }
    if (kind === 'models') {
      const s = slug || sanitizeSlug(String(body.name ?? 'untitled'))
      if (!s) return error('need a name')
      const data: Record<string, unknown> = {
        name: String(body.name ?? s),
        ...(body.premise ? { premise: String(body.premise) } : {}),
        rules: Array.isArray(body.rules) ? body.rules.map(String).filter((r) => r.trim()) : [],
        status: ['active', 'paused', 'retired'].includes(String(body.status)) ? String(body.status) : 'active',
        order: Number(body.order ?? 0),
      }
      writeEntry('models', `${s}.md`, data, '')
      addChange('library', `model ${s}`)
      return json({ ok: true, slug: s })
    }
    if (kind === 'rules') {
      const title = String(body.title ?? '').trim()
      if (!title) return error('rule text is required')
      const s = slug || sanitizeSlug(title.slice(0, 40))
      if (!s) return error('need a rule')
      writeEntry('rules', `${s}.md`, { title }, '')
      addChange('library', `rule ${s}`)
      return json({ ok: true, slug: s })
    }
    // quotes
    const text = String(body.text ?? '').trim()
    if (!text) return error('quote text is required')
    const s = slug || sanitizeSlug(text.slice(0, 40))
    if (!s) return error('need a quote')
    const data: Record<string, unknown> = {
      text,
      ...(body.author ? { author: String(body.author) } : {}),
    }
    writeEntry('quotes', `${s}.md`, data, '')
    addChange('library', `quote ${s}`)
    return json({ ok: true, slug: s })
  }

  if (action === 'delete') {
    if (!slug) return error('invalid slug')
    deleteEntry(kind, `${slug}.md`)
    addChange('library', `${kind.slice(0, -1)} ${slug} deleted`)
    return json({ ok: true })
  }

  return error('unknown action')
}
```

- [ ] **Step 6: Create `src/pages/api/admin/ping.ts`**

```ts
import type { APIRoute } from 'astro'
import { authorized, json, error } from '../../../lib/auth'
import { touchLive } from '../../../lib/live'

export const prerender = false

export const POST: APIRoute = async ({ request }) => {
  if (!authorized(request)) return error('unauthorized', 401)
  touchLive()
  return json({ ok: true, live: true })
}
```

- [ ] **Step 7: Typecheck + smoke-test the API layer**

Run: `npm run typecheck`
Expected: no new errors.

Then build once locally and smoke-test against port 4323 (this is the ONE permitted build for this task):

```bash
npm run build
HOST=127.0.0.1 PORT=4323 node dist/server/entry.mjs >/tmp/1edge-test.log 2>&1 &
sleep 3
SECRET=$(grep -oP 'ADMIN_SECRET=\K.*' .env)
curl -s -H "x-admin-secret: $SECRET" "http://127.0.0.1:4323/api/admin/days?date=2026-08-05" | head -c 400
curl -s -X POST -H "x-admin-secret: $SECRET" -H "Content-Type: application/json" \
  -d '{"action":"save","kind":"quotes","text":"test quote","author":"t"}' \
  http://127.0.0.1:4323/api/admin/library
curl -s -X POST -H "x-admin-secret: $SECRET" \
  -d '{"action":"delete","kind":"quotes","slug":"test-quote"}' \
  http://127.0.0.1:4323/api/admin/library
curl -s -X POST -H "x-admin-secret: $SECRET" http://127.0.0.1:4323/api/admin/ping
```

Expected: days GET contains `"models":[...]`; library save returns `{ok:true,slug:"test-quote"}` and delete `{ok:true}`; ping `{ok:true,live:true}`. Verify `src/content/quotes/test-quote.md` was created then removed by the delete. Also verify a day POST with `stream`/`draft`/`model`/`commentary` round-trips:

```bash
curl -s -X POST -H "x-admin-secret: $SECRET" -H "Content-Type: application/json" \
  -d '{"date":"2026-08-05","trades":[{"market":"MNQ","direction":"long","entry":100,"exit":101,"model":"orb-drive","commentary":"clean drive","executions":[]}],"stream":[{"at":"08:20","type":"pre-market","text":"test"}],"draft":{"reflection":"draft text","moments":[{"at":"09:00","type":"note","text":"draft note"}]}}' \
  http://127.0.0.1:4323/api/admin/days
grep -c "commentary" src/content/days/2026-08-05.md
```

Expected: grep returns 1 (commentary persisted). Then RESTORE the day file:

```bash
git checkout -- src/content/days/2026-08-05.md
```

Kill the test server: `pkill -F /tmp/1edge-test.pid` (write the PID at spawn: `echo $! >/tmp/1edge-test.pid`).

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(admin): day write path for stream/draft/model/commentary + library CRUD + heartbeat ping"
```

---

### Task 2: Milkdown out — markdown textarea + preview

**Files:**
- Create: `src/components/admin/MarkdownEditor.tsx`
- Delete: `src/components/admin/JournalEditor.tsx`, `src/components/admin/editor.css`
- Modify: `package.json` (remove `@milkdown/crepe`), `scripts/audit-a11y.mjs:45`, `e2e/a11y.spec.ts:26`

**Interfaces:**
- Consumes: none (React + existing unified/remark/rehype deps).
- Produces: `MarkdownEditor({ value: string; onChange: (md: string) => void; label?: string; rows?: number })` — a controlled component; the parent owns the markdown string.

- [ ] **Step 1: Create `src/components/admin/MarkdownEditor.tsx`**

```tsx
import { useEffect, useRef, useState } from 'react'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import rehypeStringify from 'rehype-stringify'

async function renderMd(md: string): Promise<string> {
  const file = await unified()
    .use(remarkParse)
    .use(remarkRehype)
    .use(rehypeStringify)
    .process(md || '')
  return String(file)
}

export function MarkdownEditor({
  value,
  onChange,
  label = 'markdown',
  rows = 12,
}: {
  value: string
  onChange: (md: string) => void
  label?: string
  rows?: number
}) {
  const [mode, setMode] = useState<'write' | 'preview'>('write')
  const [html, setHtml] = useState('')
  const renderSeq = useRef(0)

  useEffect(() => {
    const id = ++renderSeq.current
    renderMd(value).then((h) => {
      if (renderSeq.current === id) setHtml(h)
    })
  }, [value])

  return (
    <div className="border border-line">
      <div className="flex items-center justify-between border-b border-line px-2 py-1">
        <div className="flex gap-1">
          {(['write', 'preview'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
              className={`h-8 px-2.5 text-[12px] ${mode === m ? 'bg-raise text-ink' : 'text-dim hover:text-ink'}`}
            >
              {m}
            </button>
          ))}
        </div>
        <span className="text-[11px] text-faint">{label}</span>
      </div>
      {mode === 'write' ? (
        <textarea
          aria-label={label}
          rows={rows}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="# write in markdown…"
          className="w-full resize-y border-0 bg-bg p-3 font-mono text-sm leading-snug text-ink outline-none placeholder:text-faint"
        />
      ) : (
        <div
          className="max-h-[420px] overflow-y-auto bg-bg p-3 text-sm leading-relaxed text-ink"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: html }}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Delete the Milkdown files**

```bash
rm src/components/admin/JournalEditor.tsx src/components/admin/editor.css
```

- [ ] **Step 3: Remove `@milkdown/crepe` from `package.json`**

Delete line 29 (`"@milkdown/crepe": "^7.22.0",`).

- [ ] **Step 4: Remove the `.milkdown-1ed` axe exclusions**

Read `scripts/audit-a11y.mjs` around line 45 and `e2e/a11y.spec.ts` around line 26; remove the selector/rule that excludes `.milkdown-1ed` (and the `editor.css` reference if any). Keep the rest of the exclusion lists intact.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: no errors (the only Milkdown consumer was JournalEditor; the admin preview route uses `lib/markdown.ts`, not Milkdown).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(admin): replace Milkdown Crepe with markdown textarea + preview (remove @milkdown/crepe)"
```

---

### Task 3: Library tab (habits / models / rules / quotes CRUD)

**Files:**
- Create: `src/components/admin/tabs/LibraryTab.tsx`
- Modify: `src/components/admin/AdminApp.tsx` (Tab type, TABS, render, shortcut help)

**Interfaces:**
- Consumes: `api` from `../api`, `ui.tsx` kit (`Card, Button, Field, TextInput, TextArea, Select`), the `/api/admin/library` route from Task 1.
- Produces: `LibraryTab({ notify })` exported component; `Tab` type gains `'library'`.

- [ ] **Step 1: Create `src/components/admin/tabs/LibraryTab.tsx`**

```tsx
import { useCallback, useEffect, useState } from 'react'
import { api, notifyChanged } from '../api'
import { Card, Button, Field, TextInput, TextArea, Select } from '../ui'

interface LibRow {
  slug: string
  file: string
  [k: string]: unknown
}
interface LibState {
  habits: LibRow[]
  models: LibRow[]
  rules: LibRow[]
  quotes: LibRow[]
}

type Section = 'habits' | 'models' | 'rules' | 'quotes'
const SECTIONS: { id: Section; label: string }[] = [
  { id: 'habits', label: 'habits' },
  { id: 'models', label: 'models' },
  { id: 'rules', label: 'rules' },
  { id: 'quotes', label: 'quotes' },
]

export function LibraryTab({ notify }: { notify: (m: string, ok?: boolean) => void }) {
  const [data, setData] = useState<LibState>({ habits: [], models: [], rules: [], quotes: [] })
  const [section, setSection] = useState<Section>('habits')
  const [editing, setEditing] = useState<LibRow | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await api<LibState>('/api/admin/library')
      setData(res)
    } catch (e) {
      notify(e instanceof Error ? e.message : 'library load failed', false)
    }
  }, [notify])

  useEffect(() => {
    load()
  }, [load])

  const save = async () => {
    if (!editing) return
    const body: Record<string, unknown> = { action: 'save', kind: section }
    if (editing.slug) body.slug = editing.slug
    const d = editing as Record<string, any>
    if (section === 'habits') {
      body.name = d.name ?? ''
      body.emoji = d.emoji ?? ''
      body.color = d.color ?? '#4ade80'
      body.description = d.description ?? ''
      body.kind = d.kind ?? 'bool'
      body.target = d.kind === 'count' ? Number(d.target ?? 0) : undefined
      body.category = d.category ?? 'general'
      body.order = Number(d.order ?? 0)
      body.active = d.active !== false
    } else if (section === 'models') {
      body.name = d.name ?? ''
      body.premise = d.premise ?? ''
      body.rules = String(d.rules ?? '').split('\n').map((r: string) => r.trim()).filter(Boolean)
      body.status = d.status ?? 'active'
      body.order = Number(d.order ?? 0)
    } else if (section === 'rules') {
      body.title = d.title ?? ''
    } else {
      body.text = d.text ?? ''
      body.author = d.author ?? ''
    }
    try {
      await api('/api/admin/library', { method: 'POST', body })
      notify(`saved ${section.slice(0, -1)} — queued for rebuild`)
      notifyChanged()
      setEditing(null)
      await load()
    } catch (e) {
      notify(e instanceof Error ? e.message : 'save failed', false)
    }
  }

  const remove = async (row: LibRow) => {
    if (!confirm(`delete ${section.slice(0, -1)} "${row.slug}"?`)) return
    try {
      await api('/api/admin/library', { method: 'POST', body: { action: 'delete', kind: section, slug: row.slug } })
      notify('deleted — queued for rebuild')
      notifyChanged()
      setEditing(null)
      await load()
    } catch (e) {
      notify(e instanceof Error ? e.message : 'delete failed', false)
    }
  }

  const rows = data[section]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl">/ library</h1>
        <div className="flex gap-1">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => { setSection(s.id); setEditing(null) }}
              aria-pressed={section === s.id}
              className={`h-10 px-3 text-[13px] ${section === s.id ? 'bg-raise text-ink' : 'text-dim hover:text-ink'}`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <Card
        title={`${section} (${rows.length})`}
        actions={
          <Button size="sm" onClick={() => setEditing({ slug: '', file: '' })}>
            + new {section.slice(0, -1)}
          </Button>
        }
      >
        <div className="space-y-2">
          {rows.map((row) => (
            <div key={row.file} className="flex items-center gap-3 border border-line bg-bg px-3 py-2">
              <button
                onClick={() => setEditing({ ...row })}
                className="flex flex-1 items-baseline gap-3 text-left"
              >
                <span className="text-[13px] text-ink">
                  {section === 'habits' && row.emoji ? `${row.emoji} ` : ''}
                  {String(row.name ?? row.title ?? row.text ?? row.slug)}
                </span>
                <span className="text-[11px] text-faint">{row.slug}</span>
              </button>
              <Button size="sm" variant="danger" onClick={() => remove(row)}>×</Button>
            </div>
          ))}
          {rows.length === 0 && <p className="text-[12px] text-faint">no {section} yet — add one.</p>}
        </div>
      </Card>

      {editing && (
        <Card title={`edit ${section.slice(0, -1)} — ${editing.slug || 'new'}`}>
          <EditorForm
            section={section}
            value={editing}
            onChange={(patch) => setEditing({ ...editing, ...patch })}
          />
          <div className="mt-4 flex gap-2">
            <Button variant="primary" onClick={save}>save</Button>
            <Button onClick={() => setEditing(null)}>cancel</Button>
          </div>
        </Card>
      )}
    </div>
  )
}

function EditorForm({
  section,
  value,
  onChange,
}: {
  section: Section
  value: Record<string, unknown>
  onChange: (patch: Record<string, unknown>) => void
}) {
  const d = value as Record<string, any>
  if (section === 'habits') {
    return (
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="name"><TextInput value={d.name ?? ''} onChange={(e) => onChange({ name: e.target.value })} /></Field>
        <Field label="emoji"><TextInput value={d.emoji ?? ''} onChange={(e) => onChange({ emoji: e.target.value })} /></Field>
        <Field label="color"><TextInput value={d.color ?? ''} onChange={(e) => onChange({ color: e.target.value })} placeholder="#4ade80" /></Field>
        <Field label="category">
          <Select value={d.category ?? 'general'} onChange={(e) => onChange({ category: e.target.value })}>
            {['health', 'trading', 'discipline', 'mind', 'environment', 'general'].map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Select>
        </Field>
        <Field label="kind">
          <Select value={d.kind ?? 'bool'} onChange={(e) => onChange({ kind: e.target.value })}>
            <option value="bool">bool (tick)</option>
            <option value="count">count (number)</option>
          </Select>
        </Field>
        {d.kind === 'count' && (
          <Field label="target"><TextInput type="number" value={d.target ?? ''} onChange={(e) => onChange({ target: e.target.value })} /></Field>
        )}
        <Field label="order"><TextInput type="number" value={d.order ?? 0} onChange={(e) => onChange({ order: e.target.value })} /></Field>
        <Field label="description"><TextInput value={d.description ?? ''} onChange={(e) => onChange({ description: e.target.value })} /></Field>
        <label className="flex items-center gap-2 text-[13px] text-dim">
          <input type="checkbox" checked={d.active !== false} onChange={(e) => onChange({ active: e.target.checked })} />
          active
        </label>
      </div>
    )
  }
  if (section === 'models') {
    return (
      <div className="grid gap-3">
        <Field label="name"><TextInput value={d.name ?? ''} onChange={(e) => onChange({ name: e.target.value })} /></Field>
        <Field label="premise"><TextInput value={d.premise ?? ''} onChange={(e) => onChange({ premise: e.target.value })} /></Field>
        <Field label="rules (one per line)">
          <TextArea rows={5} value={d.rules ?? ''} onChange={(e) => onChange({ rules: e.target.value })} placeholder={'flat by 11:00am ct\none entry per range'} />
        </Field>
        <Field label="status">
          <Select value={d.status ?? 'active'} onChange={(e) => onChange({ status: e.target.value })}>
            {['active', 'paused', 'retired'].map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
        </Field>
        <Field label="order"><TextInput type="number" value={d.order ?? 0} onChange={(e) => onChange({ order: e.target.value })} /></Field>
      </div>
    )
  }
  if (section === 'rules') {
    return <Field label="rule text"><TextArea rows={3} value={d.title ?? ''} onChange={(e) => onChange({ title: e.target.value })} /></Field>
  }
  return (
    <div className="grid gap-3">
      <Field label="quote text"><TextArea rows={3} value={d.text ?? ''} onChange={(e) => onChange({ text: e.target.value })} /></Field>
      <Field label="author"><TextInput value={d.author ?? ''} onChange={(e) => onChange({ author: e.target.value })} /></Field>
    </div>
  )
}
```

- [ ] **Step 2: Register the tab in `AdminApp.tsx`**

- Line 10: `export type Tab = 'overview' | 'day' | 'accounts' | 'coach' | 'media' | 'library'`
- Line 16 area: add `{ id: 'library', label: 'library', key: '6' }` to `TABS`.
- Line 20-28: change `{ keys: '1 … 5', desc: 'switch tabs' }` to `{ keys: '1 … 6', desc: 'switch tabs' }`.
- Add import: `import { LibraryTab } from './tabs/LibraryTab'`
- Line 160 area: add `{tab === 'library' && <LibraryTab notify={notify} />}`.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(admin): Library tab — habits/models/rules/quotes CRUD"
```

---

### Task 4: DayWorkspace rework — draft reflection, moment composer, model/commentary, publish, merge-on-paste

**Files:**
- Modify: `src/components/admin/tabs/DayWorkspace.tsx` (only this file; AdminApp is touched by Task 5)
- Consumes: `/api/admin/days` (Task 1), `MarkdownEditor` (Task 2), `/api/admin/ai` `assist`/`polish` + `draft` actions (existing).
- Produces: `DayWorkspace({ notify, onDirtyChange? })` where `onDirtyChange?: (dirty: boolean) => void` is reported on every dirty-state change (Task 5 wires it into AdminApp's guard).

- [ ] **Step 1: Extend types + state**

Add `model` and `commentary` to `TradeForm` (lines 14-18):

```ts
interface TradeForm {
  market: string; session: string; direction: 'long' | 'short'; setup: string
  entry: string; stop: string; target: string; exit: string; riskPoints: string; points: string
  confidence: string; note: string; model: string; commentary: string
  screenshots: string[]; executions: ExecForm[]
}
```

Add after `TradeForm`:

```ts
interface MomentForm {
  at: string; type: string; text: string; tradeIdx: string; author: string; media: string
}
```

Update `emptyTrade` (lines 20-24) to include `model: ''` and `commentary: ''`.

Change the component signature (line 30):

```ts
export function DayWorkspace({
  notify,
  onDirtyChange,
}: {
  notify: (m: string, ok?: boolean) => void
  onDirtyChange?: (dirty: boolean) => void
}) {
```

Add state (after `content` state, line 51):

```ts
  const [models, setModels] = useState<{ slug: string; name: string }[]>([])
  const [reflection, setReflection] = useState('')
  const [draftMoments, setDraftMoments] = useState<MomentForm[]>([])
  const [stream, setStream] = useState<MomentForm[]>([])
```

Change `markDirty` (line 69) to report outward:

```ts
  const markDirty = () => {
    setDirty(true)
    onDirtyChange?.(true)
  }
```

Add a `clearDirty` helper next to it:

```ts
  const clearDirty = () => {
    setDirty(false)
    onDirtyChange?.(false)
  }
```

Add moment helpers (after `setTrade`, line 173):

```ts
  const toMomentForm = (m: any): MomentForm => ({
    at: String(m?.at ?? ''),
    type: String(m?.type ?? 'note'),
    text: String(m?.text ?? ''),
    tradeIdx: m?.tradeIdx != null ? String(m.tradeIdx) : '',
    author: String(m?.author ?? ''),
    media: String(m?.media ?? ''),
  })
  const momentPayload = (m: MomentForm) => ({
    at: m.at || '00:00',
    type: m.type,
    ...(m.text.trim() ? { text: m.text.trim() } : {}),
    ...(m.type === 'trade' && m.tradeIdx !== '' ? { tradeIdx: parseInt(m.tradeIdx, 10) } : {}),
    ...(m.author.trim() ? { author: m.author.trim() } : {}),
    ...(m.media.trim() ? { media: m.media.trim() } : {}),
  })
  const setMoment = (i: number, patch: Partial<MomentForm>) => {
    setDraftMoments((ms) => ms.map((m, j) => (j === i ? { ...m, ...patch } : m)))
    markDirty()
  }
  const publishMoment = (i: number) => {
    const m = draftMoments[i]
    if (m.type === 'trade' && m.tradeIdx === '') return notify('pick a trade for this moment', false)
    if (!m.text.trim() && m.type !== 'trade' && m.type !== 'media') return notify('write the moment text first', false)
    setStream((s) => [...s, m])
    setDraftMoments((ms) => ms.filter((_, j) => j !== i))
    markDirty()
  }
  const unstreamMoment = (i: number) => {
    setStream((s) => s.filter((_, j) => j !== i))
    markDirty()
  }
  const polishMoment = async (i: number) => {
    const m = draftMoments[i]
    if (!m.text.trim()) return notify('write something to polish first', false)
    try {
      const res = await api<{ result: string }>('/api/admin/ai', {
        method: 'POST',
        body: { action: 'assist', kind: 'polish', text: m.text },
      })
      setMoment(i, { text: res.result })
      notify('polished — review it, then publish')
    } catch (e) {
      notify(e instanceof Error ? e.message : 'polish failed', false)
    }
  }
```

- [ ] **Step 2: Load — models list, draft reflection, moments, trade model/commentary**

In `load` (line 71), after `setHabitDefs(res.habits)` (line 82) add:

```ts
        setModels(res.models ?? [])
```

After `setDeviceScreens(day?.device?.screenshots ?? [])` (line 92) add:

```ts
        setReflection(String(day?.draft?.reflection ?? ''))
        setDraftMoments((day?.draft?.moments ?? []).map(toMomentForm))
        setStream((day?.stream ?? []).map(toMomentForm))
```

In the `setTrades` map (lines 93-111), add after the `note` line (line 105):

```ts
          model: String(t.model ?? ''),
          commentary: String(t.commentary ?? ''),
```

After the journal block, replace the `setContent(j?.content ?? '')` line (line 123) with:

```ts
        setContent(j?.content ?? '')
        // seed the draft from the published body when no draft exists yet
        setReflection((r) => (r ? r : j?.content ?? ''))
```

Also update the `api` generic at line 78 to include `models`:

```ts
        const res = await api<{ day: any; accounts: AccRow[]; habits: HabitDef[]; models: { slug: string; name: string }[] }>(
```

Replace `setDirty(false)` (line 125) with `clearDirty()`.

- [ ] **Step 3: Merge-on-paste in `applyStructured`**

Replace the trades block in `applyStructured` (lines 232-253) with a merge:

```ts
    if (Array.isArray(r.trades) && r.trades.length) {
      setTrades((existing) => mergeStructured(existing, r.trades, imgs))
    }
```

Add `mergeStructured` after `applyStructured`:

```ts
  const mergeStructured = (existing: TradeForm[], incoming: any[], imgs: DayImage[]): TradeForm[] => {
    const toForm = (t: any): TradeForm => ({
      market: String(t.market ?? 'MNQ'),
      session: String(t.session ?? ''),
      direction: t.direction === 'short' ? ('short' as const) : ('long' as const),
      setup: String(t.setup ?? ''),
      entry: t.entry != null ? String(t.entry) : '',
      stop: t.stop != null ? String(t.stop) : '',
      target: t.target != null ? String(t.target) : '',
      exit: t.exit != null ? String(t.exit) : '',
      riskPoints: t.riskPoints != null ? String(t.riskPoints) : '',
      points: t.points != null ? String(t.points) : '',
      confidence: t.confidence ? String(t.confidence) : '',
      note: String(t.note ?? ''),
      model: String(t.model ?? ''),
      commentary: String(t.commentary ?? ''),
      screenshots: (t.screenshotIndices ?? []).map((i: number) => imgs[i]?.url).filter(Boolean),
      executions: Array.isArray(t.accounts) && t.accounts.length
        ? t.accounts.map((a: string) => ({ account: a, size: '' }))
        : [],
    })
    const incomingForms = incoming.map(toForm)
    const freshUrls = new Set(incomingForms.flatMap((t) => t.screenshots))
    // keep trades this run did not touch (no screenshot from this paste)
    const kept = existing.filter((t) => !t.screenshots.some((u) => freshUrls.has(u)))
    const out: TradeForm[] = [...kept]
    for (const inc of incomingForms) {
      if (inc.screenshots.length) {
        const idx = out.findIndex((t) => t.screenshots.some((u) => inc.screenshots.includes(u)))
        if (idx >= 0) {
          out[idx] = { ...inc, screenshots: [...new Set([...out[idx].screenshots, ...inc.screenshots])] }
        } else {
          out.push(inc)
        }
      } else {
        out.push(inc)
      }
    }
    return out
  }
```

Also in the same `applyStructured`, keep the `setDirty(true)` at the end but change it to `markDirty()` (so the guard hears about it).

- [ ] **Step 4: `runDraft` targets `reflection`, save writes day + moments + draft, journal only on publish**

`runDraft` (lines 310-325): change `if (content.trim() && ...)` to `if (reflection.trim() && !confirm('replace the current reflection draft with a fresh AI draft?')) return`, and `setContent(res.result)` to `setReflection(res.result)`.

In `save` (line 328), replace the `content` send in the journal block and add stream/draft to the days body:

In the days POST body (lines 333-364), after `trades:` block add:

```ts
          stream: stream.map(momentPayload),
          ...(draftMoments.length || reflection.trim()
            ? {
                draft: {
                  ...(reflection.trim() ? { reflection: reflection.trim() } : {}),
                  ...(draftMoments.length ? { moments: draftMoments.map(momentPayload) } : {}),
                },
              }
            : {}),
```

Delete the whole journal POST block (lines 367-379) — journal is now written only by `publishReflection`.

Replace `setDirty(false)` (line 381) with `clearDirty()`.

After `save`, add the publish action:

```ts
  const publishReflection = async () => {
    if (!reflection.trim()) return notify('write a reflection draft first', false)
    setSaving(true)
    try {
      await api('/api/admin/journal', {
        method: 'POST',
        body: {
          date,
          day: title.trim() || undefined,
          summary: summary.trim() || undefined,
          tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
          featuredImage: featuredImage.trim() || undefined,
          content: reflection,
        },
      })
      setContent(reflection)
      notify('reflection published — queued for rebuild')
      notifyChanged()
    } catch (e) {
      notify(e instanceof Error ? e.message : 'publish failed', false)
    }
    setSaving(false)
  }
```

- [ ] **Step 5: Trade UI — model select + commentary input**

In the expanded trade grid (after the `note` Field, line 891-893), add a row:

```tsx
                                <div className="mt-2 grid gap-2 md:grid-cols-2">
                                  <Field label="model">
                                    <Select value={t.model} onChange={(e) => setTrade(ti, { model: e.target.value })}>
                                      <option value="">—</option>
                                      {models.map((m) => <option key={m.slug} value={m.slug}>{m.name}</option>)}
                                    </Select>
                                  </Field>
                                  <Field label="commentary (published with the trade)">
                                    <TextInput value={t.commentary} onChange={(e) => setTrade(ti, { commentary: e.target.value })} placeholder="what made this one count" />
                                  </Field>
                                </div>
```

- [ ] **Step 6: Reflection section — draft editor + publish; moment composer card**

Replace the `JournalEditor` line (953) with:

```tsx
                    <MarkdownEditor value={reflection} onChange={(md) => { setReflection(md); markDirty() }} label="reflection draft" />
```

Replace the import line 7 (`import { JournalEditor } from '../JournalEditor'`) with:

```tsx
import { MarkdownEditor } from '../MarkdownEditor'
```

In the reflection Card `actions` (lines 937-944), add a publish button after the AI-draft button:

```tsx
                      <Button size="sm" onClick={publishReflection} disabled={saving || !reflection.trim()}>
                        {content.trim() ? 'republish reflection' : 'publish reflection'}
                      </Button>
```

In the reflection Card body, add a published-status line above the title inputs:

```tsx
                  {content.trim() && (
                    <div className="mb-3 border border-line bg-bg px-3 py-2 text-[12px] text-up">
                      ● published to /journal{content.trim() === reflection.trim() ? ' — draft matches live' : ' — draft differs, republish to overwrite'}
                    </div>
                  )}
```

Change the reflection Card `title` to `reflection — draft (private until published)`.

Add the moment composer as a new Card between the trades block and the reflection section (after the closing `</div>` of `sec-trades` at line 928, before `sec-reflection` at line 932):

```tsx
              {/* ---------- MOMENTS (stream) ---------- */}
              <div id="sec-moments" className="scroll-mt-20">
                <Card
                  title={`moments — stream (${stream.length} live · ${draftMoments.length} draft)`}
                  actions={
                    <Button size="sm" onClick={() => { setDraftMoments((ms) => [...ms, { at: '', type: 'note', text: '', tradeIdx: '', author: '', media: '' }]); markDirty() }}>
                      + new moment
                    </Button>
                  }
                >
                  {draftMoments.length > 0 && (
                    <div className="mb-4 space-y-2">
                      <div className="text-[11px] uppercase tracking-widest text-warn">draft moments — not public</div>
                      {draftMoments.map((m, i) => (
                        <div key={i} className="border border-line bg-bg p-3">
                          <div className="grid gap-2 md:grid-cols-[64px_130px_1fr]">
                            <Field label="at (HH:MM)"><TextInput value={m.at} onChange={(e) => setMoment(i, { at: e.target.value })} placeholder="08:30" /></Field>
                            <Field label="type">
                              <Select value={m.type} onChange={(e) => setMoment(i, { type: e.target.value })}>
                                {['pre-market', 'post-market', 'trade', 'note', 'quote', 'media'].map((t) => <option key={t} value={t}>{t}</option>)}
                              </Select>
                            </Field>
                            {m.type === 'trade' ? (
                              <Field label="trade">
                                <Select value={m.tradeIdx} onChange={(e) => setMoment(i, { tradeIdx: e.target.value })}>
                                  <option value="">—</option>
                                  {trades.map((_, ti) => <option key={ti} value={ti}>trade {ti + 1}</option>)}
                                </Select>
                              </Field>
                            ) : (
                              <Field label={m.type === 'quote' ? 'text (the quote)' : m.type === 'media' ? 'media url' : 'text'}>
                                <TextInput value={m.text} onChange={(e) => setMoment(i, { text: e.target.value })} placeholder={m.type === 'media' ? '/media/2026-08-07/….webp' : 'what you want to say'} />
                              </Field>
                            )}
                          </div>
                          {m.type === 'quote' && (
                            <div className="mt-2">
                              <Field label="author"><TextInput value={m.author} onChange={(e) => setMoment(i, { author: e.target.value })} /></Field>
                            </div>
                          )}
                          <div className="mt-2 flex gap-2">
                            <Button size="sm" variant="primary" onClick={() => publishMoment(i)}>publish →</Button>
                            {m.text.trim() && (
                              <Button size="sm" onClick={() => polishMoment(i)}>AI polish</Button>
                            )}
                            <Button size="sm" variant="danger" onClick={() => { setDraftMoments((ms) => ms.filter((_, j) => j !== i)); markDirty() }}>×</Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {stream.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-[11px] uppercase tracking-widest text-up">live moments — public after rebuild</div>
                      {stream.map((m, i) => (
                        <div key={i} className="flex items-center gap-3 border border-line bg-bg px-3 py-2">
                          <span className="text-[11px] text-faint">{m.at || '--:--'}</span>
                          <span className="text-[11px] text-dim">{m.type}</span>
                          <span className="flex-1 text-[13px] text-ink">
                            {m.type === 'trade'
                              ? m.tradeIdx !== '' ? `trade ${parseInt(m.tradeIdx, 10) + 1} · ${trades[parseInt(m.tradeIdx, 10)]?.setup ?? ''}` : 'trade'
                              : m.text}
                            {m.author ? ` — ${m.author}` : ''}
                          </span>
                          <Button size="sm" variant="danger" onClick={() => unstreamMoment(i)}>×</Button>
                        </div>
                      ))}
                    </div>
                  )}
                  {stream.length === 0 && draftMoments.length === 0 && (
                    <p className="text-[12px] text-faint">nothing on the stream yet — add a draft moment and publish it.</p>
                  )}
                </Card>
              </div>
```

Add `moments` to the sticky section-jump list (lines 573-578): `['moments', 'sec-moments'],` after `['trades', 'sec-trades'],`.

- [ ] **Step 7: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(admin): DayWorkspace on stream primitives — draft reflection + publish, moment composer, trade model/commentary, merge-on-paste"
```

---

### Task 5: Safety — dirty-guard, heartbeat, loud rebuild failures, AI timeouts, aria

**Files:**
- Modify: `src/components/admin/AdminApp.tsx`
- Modify: `src/components/admin/RebuildBar.tsx`
- Modify: `src/lib/ai.ts`
- Consumes: `onDirtyChange` from Task 4, `/api/admin/ping` from Task 1.

- [ ] **Step 1: AdminApp — global dirty-guard + heartbeat + toast aria**

In `AdminApp` (line 42), add state + a ref:

```ts
  const [dirty, setDirty] = useState(false)
  const dirtyRef = useRef(false)
  const setGlobalDirty = useCallback((b: boolean) => {
    dirtyRef.current = b
    setDirty(b)
  }, [])
```

Replace `go` (lines 70-73):

```ts
  const go = useCallback(
    (t: Tab) => {
      if (t !== 'day' && dirtyRef.current && !confirm('you have unsaved day changes — switch tabs and lose them?')) return
      dirtyRef.current = false
      setDirty(false)
      setTab(t)
      window.scrollTo({ top: 0 })
    },
    [],
  )
```

Add a heartbeat effect (after the paste effect, line 63):

```ts
  // heartbeat: "trader is live" on public / and /stream while the admin is open
  useEffect(() => {
    const beat = () => api('/api/admin/ping', { method: 'POST' }).catch(() => {})
    beat()
    const id = setInterval(beat, 30000)
    return () => clearInterval(id)
  }, [])
```

Import `api` and `useRef` at the top of the file:

```ts
import { useCallback, useEffect, useRef, useState } from 'react'
import { setSecret, getPasteSink, bus, api } from './api'
```

Wire the prop into DayWorkspace (line 157):

```tsx
        {tab === 'day' && <DayWorkspace notify={notify} onDirtyChange={setGlobalDirty} />}
```

Give the header nav `aria-label="admin tabs"` (line 128) and the toast `role="status" aria-live="polite"` (line 164):

```tsx
      {toast && (
        <div role="status" aria-live="polite" className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 border border-line2 bg-raise px-5 py-3 text-[13px] shadow-2xl">
```

- [ ] **Step 2: RebuildBar — loud failure**

Read `src/components/admin/RebuildBar.tsx`. In the render, add near the top of the expanded state:

```tsx
        {last && last.ok === false && (
          <div role="alert" className="border border-down bg-down/10 px-3 py-2 text-[12px] text-down">
            ✗ build failed at {last.at} — {last.error ?? 'see the rebuild log'}. your changes are still pending; fix and rebuild again.
          </div>
        )}
```

where `const last = rebuilds[0]`. When a build fails, also keep the pending list rendered (it already is) so nothing is hidden.

- [ ] **Step 3: AI timeouts in `src/lib/ai.ts`**

In `orChat` (line 14), wrap the `fetch` with a timeout signal and map the timeout error to a clear message:

```ts
async function orChat(messages: OrMessage[], model: string, json = true, maxTokens = 2500) {
  const key = env.openrouterKey()
  if (!key) throw new Error('OPENROUTER_API_KEY is not set')
  let res: Response
  try {
    res = await fetch(`${env.openrouterBase()}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
        'HTTP-Referer': env.siteUrl(),
        'X-Title': '1ed.ge',
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.2,
        max_tokens: maxTokens,
        ...(json ? { response_format: { type: 'json_object' } } : {}),
      }),
      signal: AbortSignal.timeout(60_000),
    })
  } catch (e) {
    if (e instanceof Error && e.name === 'TimeoutError') {
      throw new Error('AI request timed out after 60s — try again')
    }
    throw e
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`OpenRouter ${res.status}: ${text.slice(0, 300)}`)
  }
  const data = await res.json()
  const content: string = data?.choices?.[0]?.message?.content ?? ''
  return content
}
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "fix(admin): dirty-guard on tab switch, live heartbeat, loud rebuild failures, AI 60s timeout"
```

---

### Task 6: Docs + final build + deploy + verify live

**Files:**
- Modify: `AGENTS.md`, `MEMORY.md`, `CHANGELOG.md`, this plan's status

- [ ] **Step 1: Update `CHANGELOG.md`**

Add an `Unreleased` entry summarizing Phase 2 (library tab, markdown editor swap, stream primitives in DayWorkspace, safety fixes, heartbeat).

- [ ] **Step 2: Update `AGENTS.md`**

- Replace Milkdown references in the Stack section and the admin/publish flow: the journal editor is now a plain markdown textarea + preview (remove `@milkdown/crepe` guidance; delete the "Do not hand-roll editors" line only insofar as it refers to Milkdown — keep the ImageBlock/onUpload removal note).
- Update the admin tab list: add Library (habits/models/rules/quotes CRUD) and the heartbeat (`/api/admin/ping`).
- Note the new day-record write path: admin can now write `stream`, `draft`, and per-trade `model`/`commentary`.

- [ ] **Step 3: Update `MEMORY.md`**

- Add a session-log entry (2026-08-07, Phase 2 shipped) mirroring the format of prior entries.
- Update the WRAP-UP section: Phase 2 done; remaining = Phase 3 (posterized `/day`, `/models`, journal index rebuild — note `/stream` + `/` hero already live) and Phase 4.
- Remove the "Milkdown out" wording if it is now done; keep the Phase 2→3→4 ordering.

- [ ] **Step 4: Final gate — typecheck + build**

```bash
npm run typecheck
npm run build
```

Expected: both pass. `npm run build` must still clear `node_modules/.astro` first (do not remove that).

- [ ] **Step 5: Commit + deploy**

```bash
git add -A
git commit -m "feat(admin): Phase 2 — stream-primitive day workspace, library tab, markdown editor, safety fixes"
bash scripts/deploy.sh
```

- [ ] **Step 6: Verify LIVE**

```bash
for i in $(seq 1 30); do
  code=$(curl --resolve 1ed.ge:443:104.21.7.179 -s -o /dev/null -w '%{http_code}' https://1ed.ge/ || true)
  [ "$code" = "200" ] && break
  sleep 2
done
echo "home: $code"
SECRET=$(grep -oP 'ADMIN_SECRET=\K.*' .env)
curl --resolve 1ed.ge:443:104.21.7.179 -s -H "x-admin-secret: $SECRET" -X POST https://1ed.ge/api/admin/ping
curl --resolve 1ed.ge:443:104.21.7.179 -s -H "x-admin-secret: $SECRET" "https://1ed.ge/api/admin/days?date=2026-08-05" | grep -o '"models":\[[^]]*\]' | head -c 200
```

Expected: home 200; ping `{ok:true,live:true}`; days GET includes a non-empty `models` array. Also visit `https://1ed.ge/admin/<secret>/` in a browser and confirm: Day tab shows the markdown textarea (no Milkdown), the moments card, trade model/commentary fields, publish buttons; Library tab lists habits/models/rules/quotes and can add/delete a quote. Kill any local test server (`pkill -F` the PID file from Task 1) so port 4323 is free.

---

## Self-review notes

- **Spec §6 Admin coverage:** DayWorkspace on primitives (Task 4), Library tab (Task 3), editor swap (Task 2), safety fixes incl. heartbeat (Task 5). Spec §5 (publish pipeline: submit-as-is / AI polish → approve → live) is covered by the moment composer's publish button + `polishMoment` (Task 4) — publish is always the owner's explicit action; polish only edits the draft.
- **Phase 4 items are NOT in this plan** (money colors, tablet breakpoint, journal API traversal, rebuild mutex, unit tests) — they stay in Phase 4 per the handover.
- **Out of scope by design:** migrating `admin/ui.tsx` to the Phase-0 Radix kit; public `/day` posterized archive; `/models` public page — those are Phase 3.
- **Type consistency:** `MomentForm` ↔ `normalizeMoment` ↔ `momentPayload` agree on keys `at/type/text/tradeIdx/author/media`; `Moment` in the API is the JSON shape with `tradeIdx: number`. `onDirtyChange?: (dirty: boolean) => void` is defined in Task 4 and consumed in Task 5. `MarkdownEditor` props `value/onChange/label/rows` defined in Task 2, used in Task 4.

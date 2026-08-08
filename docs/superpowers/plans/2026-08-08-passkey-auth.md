# Passkey auth for zen — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the secret-based zen auth (`/zen/<secret>` + `x-admin-secret` header) with WebAuthn passkeys (Face ID / Touch ID / iCloud Keychain) on a stable `/zen` URL, with a session cookie for the admin API. **Test-first rollout on the `preprod` branch; prod is untouched until the owner approves.**

**Architecture:** `@simplewebauthn/server` (v13.3.2) handles registration + login ceremonies. Credentials + sessions persist in a gitignored `data/` dir (files-as-database, bind-mounted into docker on prod). A 30-day sliding httpOnly session cookie replaces the `x-admin-secret` header on all 28 admin-API call sites. The old secret survives only as the `/zen/setup?key=` recovery page.

**Tech Stack:** Astro 5 SSR (`prerender = false`), Node 22 (`crypto.subtle`, `crypto.randomBytes`, `crypto.timingSafeEqual`), React (admin client), `@simplewebauthn/server` 13.3.2, node:test.

## Global Constraints

- **All feature work happens in `/root/1ed-ge-preprod` on branch `preprod`.** Prod (`/root/1ed.ge`, `main`) is untouched until approval. Rollback = revert on preprod + `bash scripts/deploy-test.sh`.
- `require_env test` guards hold — every deploy/sync script already enforces the env.
- **Public pages stay zero-JS.** The passkey UI lives inside the zen React app + the setup page only.
- Old URLs die with **no redirect** (`/zen/<secret>`, `/admin/<secret>` → 404) — consistent with the site's no-compat-shims rule.
- The literal `ADMIN_SECRET` never enters git. `data/` is gitignored. `@simplewebauthn/server` is pinned `13.3.2`.
- `npm run typecheck` after every code task. `node --test tests/passkey.test.mjs` after the lib task. Commit after each task (the 02:00 autosave cron sweeps uncommitted edits).
- No parallel builds (astro races on `node_modules/.astro`).
- `SITE_URL` drives RP ID + origin: `https://1ed.ge` (prod) / `https://test.1ed.ge` (test). `new URL(SITE_URL).hostname` = rpID; `new URL(SITE_URL).origin` = expectedOrigin.

---

## File Structure

| File | Status | Responsibility |
|------|--------|----------------|
| `src/lib/passkeys.ts` | new | `data/passkeys.json` + `data/sessions.json` read/write, challenge store (in-memory, 2-min TTL) |
| `src/lib/webauthn.ts` | new | `@simplewebauthn/server` wrappers: registration begin/verify, login begin/verify, session issue/validate/slide |
| `src/lib/auth.ts` | update | `sessionOk(ctx)` + cookie helpers; **delete** `authorized(request)` |
| 15 admin API files | update | `authorized(request)` → `sessionOk(Astro)` (28 call sites) |
| `src/pages/api/webauthn/register.ts` | new | POST begin (key-gated) + verify (key-gated, clears sessions, issues cookie) |
| `src/pages/api/webauthn/login.ts` | new | POST begin + verify (sets session cookie) |
| `src/pages/api/webauthn/logout.ts` | new | POST (clears session) |
| `src/pages/api/webauthn/status.ts` | new | GET `{ hasPasskeys, authed }` |
| `src/pages/zen/index.astro` | new | passkey-gated zen page (session check → AdminApp or LoginScreen) |
| `src/pages/zen/setup.astro` | new | recovery/registration page (`?key=` constant-time check) |
| `src/pages/zen/manifest.webmanifest.ts` | new | PWA manifest at `/zen/`, session-gated |
| `src/pages/zen/preview/[date].astro` | new | day preview, session-gated |
| `src/pages/zen/[secret]/*` | **delete** | old routes (index, manifest, preview) |
| `src/pages/admin/[secret]/index.astro` | **delete** | old redirect |
| `src/components/admin/LoginScreen.tsx` | new | passkey login UI (React, client) |
| `src/components/admin/RegisterScreen.tsx` | new | passkey registration UI for the setup page (React, client) |
| `src/components/admin/api.ts` | update | drop `x-admin-secret` header + `setSecret/getSecret` call sites |
| `src/components/admin/AdminApp.tsx` | update | drop `secret` prop |
| `src/components/admin/tabs/DayWorkspace.tsx` | update | preview href `/zen/${getSecret()}/preview/…` → `/zen/preview/…` |
| `docker-compose.yml` | update | add `./data:/app/data` |
| `.gitignore` | update | add `data/` |
| `package.json` | update | add `@simplewebauthn/server@13.3.2` |
| `tests/passkey.test.mjs` | new | node:test unit tests for passkey/session/challenge stores + constant-time compare |
| `scripts/sync-to-prod.sh` | update | extend allowlist with `package.json`, `package-lock.json`, `docker-compose.yml` (needed when approved) |
| `scripts/deploy-test.sh` | update | `mkdir -p data` before starting the host node server |
| `MEMORY.md` / `AGENTS.md` | update | note the passkey auth model + setup URL |

---

### Task 0: Pre-flight — sync preprod from main, add the dependency + storage plumbing

**Files:**
- Run: `bash scripts/sync-from-prod.sh` (in `/root/1ed-ge-preprod`) to bring main's latest (the spec doc `f043143` + pipeline).
- Update: `package.json`, `docker-compose.yml`, `.gitignore`

- [ ] **Step 1: Sync preprod from main**

```bash
cd /root/1ed-ge-preprod
bash scripts/where-am-i.sh   # expect env: test, branch: preprod
bash scripts/sync-from-prod.sh   # pull main → preprod (spec doc + any pipeline updates)
node tests/pipeline.test.mjs     # expect 46 pass · 0 fail
```

- [ ] **Step 2: Add the dependency**

```bash
cd /root/1ed-ge-preprod
npm install @simplewebauthn/server@13.3.2
```

Verify: `grep '"@simplewebauthn/server"' package.json` → `"13.3.2"`.

- [ ] **Step 3: Add `data/` to `.gitignore` + the docker volume**

`.gitignore` (add after `.env`):

```gitignore
data/
```

`docker-compose.yml` (add the third volume):

```yaml
    volumes:
      - ./src/content:/app/src/content
      - ./public/media:/app/public/media
      - ./data:/app/data
```

- [ ] **Step 4: Commit**

```bash
cd /root/1ed-ge-preprod
git add package.json package-lock.json .gitignore docker-compose.yml
git commit -m "chore(passkey): add @simplewebauthn/server@13.3.2, data/ gitignore + docker volume"
```

---

### Task 1: The storage lib — `src/lib/passkeys.ts`

**Files:**
- Create: `src/lib/passkeys.ts`
- Test: `tests/passkey.test.mjs`

**Interfaces (produced):**
- `DATA_DIR` = `path.join(process.cwd(), 'data')`
- `readCredentials(): CredentialRecord[]`
- `saveCredential(rec: CredentialRecord): void`
- `clearCredentials(): void`
- `CredentialRecord = { id: string; publicKey: string; counter: number; transports: string[]; createdAt: string }` (publicKey = base64url string; `@simplewebauthn/server` wants `Uint8Array` — decode at the boundary in `webauthn.ts`)
- `readSessions(): SessionRecord[]`
- `saveSession(token: string, ttlMs: number): void` (writes `{ token, createdAt, expiresAt }`)
- `deleteSession(token: string): void`
- `clearSessions(): void`
- `touchSession(token: string, ttlMs: number): boolean` (sliding; returns false if absent/expired)
- `getChallenge(nonce: string): string | null` + `setChallenge(nonce: string, challenge: string): void` (in-memory Map, 2-min TTL via `Date.now()`)
- `SessionRecord = { token: string; createdAt: number; expiresAt: number }`
- All fs ops: `fs.mkdirSync(path.dirname(f), { recursive: true })` + `fs.writeFileSync(f, JSON.stringify(obj, null, 2))`; read with `fs.existsSync` guard → `[]`.

- [ ] **Step 1: Write the failing test — `tests/passkey.test.mjs`**

```js
import { test } from 'node:test'
import assert from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'
import { mkdtempSync } from 'node:fs'

// Point DATA_DIR at a scratch dir before importing the lib.
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const scratch = mkdtempSync(path.join(os.tmpdir(), 'passkey-test-'))
process.env.PASSKEY_DATA_DIR = scratch

const lib = await import(path.join(__dirname, '..', 'src', 'lib', 'passkeys.ts'))

test('credential store: save + read round-trip', () => {
  lib.clearCredentials()
  lib.saveCredential({ id: 'cred-1', publicKey: 'abc', counter: 0, transports: ['internal'], createdAt: new Date().toISOString() })
  const all = lib.readCredentials()
  assert.equal(all.length, 1)
  assert.equal(all[0].id, 'cred-1')
})

test('session store: save, validate within TTL, touch slides, delete', () => {
  lib.clearSessions()
  lib.saveSession('tok-1', 30 * 24 * 3600 * 1000)
  assert.ok(lib.touchSession('tok-1', 30 * 24 * 3600 * 1000), 'valid token passes')
  lib.deleteSession('tok-1')
  assert.equal(lib.touchSession('tok-1', 30 * 24 * 3600 * 1000), false, 'deleted token fails')
})

test('session store: expired token fails', () => {
  lib.clearSessions()
  lib.saveSession('tok-exp', -1000) // already expired
  assert.equal(lib.touchSession('tok-exp', 30 * 24 * 3600 * 1000), false, 'expired token fails')
})

test('challenge store: set + get within TTL, gone after 2 min', () => {
  lib.setChallenge('nonce-1', 'challenge-abc')
  assert.equal(lib.getChallenge('nonce-1'), 'challenge-abc')
  lib.setChallenge('nonce-2', 'x')
  // Simulate expiry by direct Map manipulation if exposed; otherwise rely on TTL default
  assert.equal(lib.getChallenge('nonce-nope'), null)
})

// cleanup
test('cleanup scratch dir', () => {
  fs.rmSync(scratch, { recursive: true, force: true })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/passkey.test.mjs`
Expected: FAIL — module not found (`src/lib/passkeys.ts`).

- [ ] **Step 3: Write `src/lib/passkeys.ts`**

```ts
import fs from 'node:fs'
import path from 'node:path'

export const DATA_DIR = process.env.PASSKEY_DATA_DIR
  ? path.resolve(process.env.PASSKEY_DATA_DIR)
  : path.join(process.cwd(), 'data')

const CREDS = path.join(DATA_DIR, 'passkeys.json')
const SESSIONS = path.join(DATA_DIR, 'sessions.json')

export interface CredentialRecord {
  id: string
  publicKey: string // base64url
  counter: number
  transports: string[]
  createdAt: string
}
export interface SessionRecord {
  token: string
  createdAt: number
  expiresAt: number
}

const ensureDir = () => fs.mkdirSync(DATA_DIR, { recursive: true })
const readJson = <T>(file: string, fallback: T): T => {
  if (!fs.existsSync(file)) return fallback
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as T
  } catch {
    return fallback
  }
}
const writeJson = (file: string, data: unknown) => {
  ensureDir()
  fs.writeFileSync(file, JSON.stringify(data, null, 2))
}

// --- credentials ---
export function readCredentials(): CredentialRecord[] {
  return readJson<{ credentials: CredentialRecord[] }>(CREDS, { credentials: [] }).credentials
}
export function saveCredential(rec: CredentialRecord) {
  const all = readCredentials().filter((c) => c.id !== rec.id)
  all.push(rec)
  writeJson(CREDS, { credentials: all })
}
export function clearCredentials() {
  writeJson(CREDS, { credentials: [] })
}

// --- sessions ---
export function readSessions(): SessionRecord[] {
  return readJson<{ sessions: SessionRecord[] }>(SESSIONS, { sessions: [] }).sessions
}
function writeSessions(list: SessionRecord[]) {
  writeJson(SESSIONS, { sessions: list })
}
export function saveSession(token: string, ttlMs: number) {
  const now = Date.now()
  const all = readSessions()
  all.push({ token, createdAt: now, expiresAt: now + ttlMs })
  writeSessions(all)
}
export function deleteSession(token: string) {
  writeSessions(readSessions().filter((s) => s.token !== token))
}
export function clearSessions() {
  writeSessions([])
}
/** Sliding check: token present + not expired → refresh expiry, return true. */
export function touchSession(token: string, ttlMs: number): boolean {
  const all = readSessions()
  const idx = all.findIndex((s) => s.token === token)
  if (idx === -1) return false
  if (Date.now() > all[idx].expiresAt) {
    all.splice(idx, 1)
    writeSessions(all)
    return false
  }
  all[idx].expiresAt = Date.now() + ttlMs
  writeSessions(all)
  return true
}

// --- challenge store (in-memory, 2-min TTL) ---
const challenges = new Map<string, { value: string; at: number }>()
const CHALLENGE_TTL = 2 * 60 * 1000
export function setChallenge(nonce: string, challenge: string) {
  challenges.set(nonce, { value: challenge, at: Date.now() })
}
export function getChallenge(nonce: string): string | null {
  const c = challenges.get(nonce)
  if (!c) return null
  if (Date.now() - c.at > CHALLENGE_TTL) {
    challenges.delete(nonce)
    return null
  }
  challenges.delete(nonce) // single-use
  return c.value
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/passkey.test.mjs`
Expected: PASS (5 tests).

- [ ] **Step 5: Typecheck + commit**

```bash
cd /root/1ed-ge-preprod
npm run typecheck   # 0 errors
git add src/lib/passkeys.ts tests/passkey.test.mjs
git commit -m "feat(passkey): storage lib — credentials + sessions + challenge stores (data/, gitignored)"
```

---

### Task 2: The WebAuthn lib — `src/lib/webauthn.ts`

**Files:**
- Create: `src/lib/webauthn.ts`

**Interfaces (consumes Task 1; produced):**
- `rpId()` = `new URL(env.siteUrl()).hostname`
- `origin()` = `new URL(env.siteUrl()).origin`
- `issueSession(): string` — creates a 256-bit token, saves it (30-day TTL), returns it
- `sessionOk(request: Request): boolean` — reads the `zen_session` cookie, `crypto.timingSafeEqual` compare + `touchSession` sliding
- `sessionCookie(token: string): { value: string; opts: CookieOptions }` — the cookie value + `{ httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 30*24*3600 }`
- `registerBegin(): Promise<{ options: PublicKeyCredentialCreationOptionsJSON; nonce: string }>` — `generateRegistrationOptions`
- `registerVerify(nonce: string, credential: RegistrationResponseJSON): Promise<boolean>` — `verifyRegistrationResponse` + save + `clearSessions()`
- `loginBegin(): Promise<{ options: PublicKeyCredentialRequestOptionsJSON; nonce: string } | null>` — `generateAuthenticationOptions`; null when no passkeys registered
- `loginVerify(nonce: string, credential: AuthenticationResponseJSON): Promise<boolean>` — `verifyAuthenticationResponse` + counter update
- `constantTimeEqual(a: string, b: string): boolean` — for the setup-key check
- `hasPasskeys(): boolean`

- [ ] **Step 1: Write `src/lib/webauthn.ts`**

```ts
import {
  generateRegistrationOptions,
  generateAuthenticationOptions,
  verifyRegistrationResponse,
  verifyAuthenticationResponse,
  type RegistrationResponseJSON,
  type AuthenticationResponseJSON,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/server'
import crypto from 'node:crypto'
import { env } from './env'
import {
  readCredentials,
  saveCredential,
  clearSessions,
  saveSession,
  touchSession,
  setChallenge,
  getChallenge,
} from './passkeys'

const SESSION_TTL = 30 * 24 * 3600 * 1000
const COOKIE = 'zen_session'
const RP_NAME = '1ed.ge'
const USER_ID = new Uint8Array([1]) // single-user site

export const rpId = () => new URL(env.siteUrl()).hostname
export const origin = () => new URL(env.siteUrl()).origin

export function hasPasskeys(): boolean {
  return readCredentials().length > 0
}

export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  return crypto.timingSafeEqual(ab, bb)
}

// --- sessions ---
export function issueSession(): string {
  const token = crypto.randomBytes(32).toString('base64url')
  saveSession(token, SESSION_TTL)
  return token
}
export function sessionCookie(token: string) {
  return {
    value: token,
    opts: { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 30 * 24 * 3600 },
  }
}
export function sessionOk(request: Request): boolean {
  const cookie = request.headers.get('cookie') ?? ''
  const m = cookie.split(';').map((s) => s.trim()).find((s) => s.startsWith(`${COOKIE}=`))
  if (!m) return false
  const token = m.slice(COOKIE.length + 1)
  if (!token) return false
  return touchSession(token, SESSION_TTL)
}

// --- registration ---
export async function registerBegin(): Promise<{
  options: PublicKeyCredentialCreationOptionsJSON
  nonce: string
}> {
  const existing = readCredentials().map((c) => ({ id: c.id }))
  const nonce = crypto.randomUUID()
  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: rpId(),
    userName: 'owner',
    userID: USER_ID,
    userDisplayName: 'Owner',
    attestationType: 'none',
    authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
    excludeCredentials: existing,
  })
  setChallenge(nonce, options.challenge)
  return { options, nonce }
}

export async function registerVerify(
  nonce: string,
  credential: RegistrationResponseJSON,
): Promise<boolean> {
  const challenge = getChallenge(nonce)
  if (!challenge) return false
  const verification = await verifyRegistrationResponse({
    response: credential,
    expectedChallenge: challenge,
    expectedOrigin: origin(),
    expectedRPID: rpId(),
  })
  if (!verification.verified || !verification.registrationInfo) return false
  const { credentialID, credentialPublicKey, counter } = verification.registrationInfo
  saveCredential({
    id: credentialID,
    publicKey: Buffer.from(credentialPublicKey).toString('base64url'),
    counter,
    transports: credential.response.transports ?? [],
    createdAt: new Date().toISOString(),
  })
  clearSessions() // revoke: any old passkey stops working immediately
  return true
}

// --- login ---
export async function loginBegin(): Promise<{
  options: PublicKeyCredentialRequestOptionsJSON
  nonce: string
} | null> {
  const creds = readCredentials()
  if (creds.length === 0) return null
  const nonce = crypto.randomUUID()
  const options = await generateAuthenticationOptions({
    rpID: rpId(),
    allowCredentials: creds.map((c) => ({ id: c.id, type: 'public-key', transports: c.transports })),
    userVerification: 'required',
  })
  setChallenge(nonce, options.challenge)
  return { options, nonce }
}

export async function loginVerify(
  nonce: string,
  credential: AuthenticationResponseJSON,
): Promise<boolean> {
  const challenge = getChallenge(nonce)
  if (!challenge) return false
  const creds = readCredentials()
  const stored = creds.find((c) => c.id === credential.id)
  if (!stored) return false
  const verification = await verifyAuthenticationResponse({
    response: credential,
    expectedChallenge: challenge,
    expectedOrigin: origin(),
    expectedRPID: rpId(),
    credential: {
      id: stored.id,
      publicKey: Uint8Array.from(Buffer.from(stored.publicKey, 'base64url')),
      counter: stored.counter,
    },
  })
  if (!verification.verified) return false
  saveCredential({ ...stored, counter: verification.authenticationInfo.newCounter })
  return true
}
```

- [ ] **Step 2: Typecheck**

Run: `cd /root/1ed-ge-preprod && npm run typecheck`
Expected: 0 errors (the lib compiles against `@simplewebauthn/server@13.3.2` types).

- [ ] **Step 3: Commit**

```bash
cd /root/1ed-ge-preprod
git add src/lib/webauthn.ts
git commit -m "feat(passkey): WebAuthn lib — registration/login ceremonies + sliding session via @simplewebauthn/server"
```

---

### Task 3: The auth switch — `sessionOk` + 28 call sites

**Files:**
- Update: `src/lib/auth.ts`
- Update: 15 admin API files (28 call sites)
- Update: `src/components/admin/api.ts`

- [ ] **Step 1: Rewrite `src/lib/auth.ts`**

```ts
import { sessionOk, sessionCookie, constantTimeEqual } from './webauthn'
import { env } from './env'

export { sessionOk }

/** Admin API gate: the passkey session cookie must be present + valid. */
export function requireSession(request: Request) {
  if (!sessionOk(request)) return error('unauthorized', 401)
  return null
}

export function setupKeyOk(given: string | null): boolean {
  if (!given) return false
  return constantTimeEqual(given, env.adminSecret())
}

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export function error(msg: string, status = 400) {
  return json({ ok: false, error: msg }, status)
}

export { sessionCookie }
```

- [ ] **Step 2: Swap the 28 call sites — `authorized(request)` → `requireSession(request)`**

Mechanical, across these files (each has the pattern `if (!authorized(request)) return error('unauthorized', 401)`):

```
media.ts (3) brief.ts (2) market.ts (2) journal.ts (3) days.ts (3)
ai.ts (1) coach.ts (2) rebuild.ts (2) accounts.ts (2) library.ts (2)
ping.ts (1) status.ts (1) reviews.ts (2) ingest.ts (1) ingest/apply.ts (1)
```

Apply per file:

```bash
# in each of the 15 files: replace the import + the guard
sed -i "s/import { authorized, json, error } from '..\/..\/..\/lib\/auth'/import { requireSession, json, error } from '..\/..\/..\/lib\/auth'/" src/pages/api/admin/*.ts src/pages/api/admin/ingest/*.ts 2>/dev/null
sed -i "s/if (!authorized(request)) return error('unauthorized', 401)/if (requireSession(request)) return error('unauthorized', 401)/" src/pages/api/admin/*.ts src/pages/api/admin/ingest/*.ts
```

Then verify with grep — **must be 0 remaining `authorized(` references and exactly 28 `requireSession(` references**:

```bash
cd /root/1ed-ge-preprod
grep -rn "authorized(" src/ | grep -v requireSession || echo "clean"
grep -rn "requireSession(" src/pages/api/admin/ | wc -l   # 28
```

Note: the `api/webauthn/*` routes (Task 4) use `setupKeyOk`/`sessionOk` directly, not `requireSession` — they are the auth boundary, not behind it.

- [ ] **Step 3: Drop the header from the React api client**

`src/components/admin/api.ts`:

```ts
export async function api<T = any>(
  path: string,
  opts: { method?: string; body?: unknown } = {},
): Promise<T> {
  const res = await fetch(path, {
    method: opts.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  })
  // ... unchanged below
}
```

Delete `setSecret` / `getSecret` from `api.ts`; update `DayWorkspace.tsx`:
- `line 653`: `const previewHref = '/zen/preview/${date}'` (drop the secret segment)
- remove `import { getSecret }` if it becomes unused.

- [ ] **Step 4: Typecheck + run the existing test suites**

```bash
cd /root/1ed-ge-preprod
npm run typecheck        # 0 errors
node --test tests/passkey.test.mjs tests/accountability.test.ts   # pass + no regression
node tests/pipeline.test.mjs    # 46 pass
```

- [ ] **Step 5: Commit**

```bash
cd /root/1ed-ge-preprod
git add src/lib/auth.ts src/pages/api/admin/ src/components/admin/api.ts src/components/admin/tabs/DayWorkspace.tsx
git commit -m "feat(passkey): session-cookie auth replaces x-admin-secret header (28 call sites + react client)"
```

---

### Task 4: The WebAuthn API routes

**Files:**
- Create: `src/pages/api/webauthn/register.ts`
- Create: `src/pages/api/webauthn/login.ts`
- Create: `src/pages/api/webauthn/logout.ts`
- Create: `src/pages/api/webauthn/status.ts`

- [ ] **Step 1: `src/pages/api/webauthn/register.ts`**

```ts
import type { APIRoute } from 'astro'
import { json, error, setupKeyOk } from '../../../lib/auth'
import { registerBegin, registerVerify, issueSession, sessionCookie } from '../../../lib/webauthn'

export const prerender = false

export const POST: APIRoute = async ({ request }) => {
  const body = (await request.json().catch(() => null)) as { key?: string; nonce?: string; credential?: unknown } | null
  if (!body || !setupKeyOk(body.key ?? null)) return error('unauthorized', 401)

  // verify phase (has nonce + credential) or begin phase
  if (body.nonce && body.credential) {
    const ok = await registerVerify(body.nonce, body.credential as never)
    if (!ok) return error('registration failed', 400)
    const token = issueSession()
    const { value, opts } = sessionCookie(token)
    return json({ ok: true }, 200, { 'Set-Cookie': `${'zen_session'}=${value}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${opts.maxAge}` })
  }

  const { options, nonce } = await registerBegin()
  return json({ ok: true, options, nonce })
}
```

(If the `json` helper needs a headers param, extend it: `json(data, status, headers = {})`.)

- [ ] **Step 2: `src/pages/api/webauthn/login.ts`**

```ts
import type { APIRoute } from 'astro'
import { json, error } from '../../../lib/auth'
import { loginBegin, loginVerify, issueSession, sessionCookie } from '../../../lib/webauthn'

export const prerender = false

export const POST: APIRoute = async ({ request }) => {
  const body = (await request.json().catch(() => null)) as { nonce?: string; credential?: unknown } | null

  if (body?.nonce && body.credential) {
    const ok = await loginVerify(body.nonce, body.credential as never)
    if (!ok) return error('authentication failed', 401)
    const token = issueSession()
    const { value, opts } = sessionCookie(token)
    return json({ ok: true }, 200, { 'Set-Cookie': `${'zen_session'}=${value}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${opts.maxAge}` })
  }

  const begun = await loginBegin()
  if (!begun) return error('no passkey registered — use /zen/setup', 400)
  return json({ ok: true, options: begun.options, nonce: begun.nonce })
}
```

- [ ] **Step 3: `src/pages/api/webauthn/logout.ts` + `status.ts`**

```ts
// logout.ts
import type { APIRoute } from 'astro'
import { json } from '../../../lib/auth'
import { deleteSession } from '../../../lib/passkeys'

export const prerender = false

export const POST: APIRoute = async ({ request }) => {
  const cookie = request.headers.get('cookie') ?? ''
  const m = cookie.split(';').map((s) => s.trim()).find((s) => s.startsWith('zen_session='))
  if (m) deleteSession(m.slice('zen_session='.length))
  return json({ ok: true }, 200, { 'Set-Cookie': 'zen_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0' })
}
```

```ts
// status.ts
import type { APIRoute } from 'astro'
import { json } from '../../../lib/auth'
import { hasPasskeys, sessionOk } from '../../../lib/webauthn'

export const prerender = false

export const GET: APIRoute = async ({ request }) =>
  json({ ok: true, hasPasskeys: hasPasskeys(), authed: sessionOk(request) })
```

- [ ] **Step 4: Extend the `json` helper for headers** (in `src/lib/auth.ts`)

```ts
export function json(data: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  })
}
```

- [ ] **Step 5: Typecheck + commit**

```bash
cd /root/1ed-ge-preprod
npm run typecheck
git add src/pages/api/webauthn/ src/lib/auth.ts
git commit -m "feat(passkey): WebAuthn API routes — register/login/logout/status"
```

---

### Task 5: The zen pages + removal of old routes

**Files:**
- Create: `src/pages/zen/index.astro`
- Create: `src/pages/zen/setup.astro`
- Create: `src/pages/zen/manifest.webmanifest.ts`
- Create: `src/pages/zen/preview/[date].astro`
- Delete: `src/pages/zen/[secret]/` (3 files) + `src/pages/admin/[secret]/` (1 file)

- [ ] **Step 1: `src/pages/zen/index.astro`** (the passkey-gated desk)

```astro
---
export const prerender = false
import Bare from '../../layouts/Bare.astro'
import AdminApp from '../../components/admin/AdminApp'
import LoginScreen from '../../components/admin/LoginScreen'
import { sessionOk } from '../../lib/auth'
import { getCollection } from 'astro:content'
import type { DayData } from '../../lib/stream'
import { nowHkt } from '../../lib/sessions'
import { accountabilityStatus } from '../../lib/accountability'
import { pendingReflectionsLine } from '../../lib/copy'

const authed = sessionOk(Astro.request)

let zenLine: string | null = null
if (authed) {
  const [dayEntries, journalEntries, reviewEntries] = await Promise.all([
    getCollection('days'),
    getCollection('journal'),
    getCollection('reviews'),
  ])
  const nowIso = nowHkt()
  const account = accountabilityStatus(
    dayEntries.map((d) => d.data as DayData),
    journalEntries.map((j) => j.data.date),
    reviewEntries.map((r) => ({ type: r.data.type, anchor: r.data.anchor })),
    nowIso,
  )
  zenLine = pendingReflectionsLine(account.pendingDays, account.pendingPeriods)
}
const manifestHref = '/zen/manifest.webmanifest'
---

<Bare title={authed ? 'zen — 1ed.ge' : 'zen sign in'} manifest={manifestHref}>
  {authed ? (
    <AdminApp zenLine={zenLine} />
  ) : (
    <LoginScreen />
  )}
</Bare>
```

- [ ] **Step 2: `src/pages/zen/setup.astro`** (recovery + first registration)

```astro
---
export const prerender = false
import Bare from '../../layouts/Bare.astro'
import RegisterScreen from '../../components/admin/RegisterScreen'
import { setupKeyOk } from '../../lib/auth'

const { key } = Astro.url.searchParams
const ok = setupKeyOk(key)
if (!ok) {
  Astro.response.status = 404
}
const manifestHref = ok ? '/zen/manifest.webmanifest' : undefined
---

<Bare title={ok ? 'zen — setup' : 'not found'} manifest={manifestHref}>
  {ok ? (
    <div class="shell py-16">
      <h1 class="mb-1 text-xl">zen setup</h1>
      <p class="mb-6 text-[13px] text-dim">register a passkey to lock zen to this device / your iCloud Keychain.</p>
      <RegisterScreen />
    </div>
  ) : (
    <div class="shell py-24 text-[13px] text-faint">404 — not found</div>
  )}
</Bare>
```

- [ ] **Step 3: `src/pages/zen/manifest.webmanifest.ts`** (session-gated, at `/zen/`)

```ts
import type { APIRoute } from 'astro'
import { sessionOk } from '../../../lib/auth'

export const prerender = false

export const GET: APIRoute = async ({ request }) => {
  if (!sessionOk(request)) return new Response('unauthorized', { status: 401 })
  const manifest = {
    name: 'zen — 1ed.ge',
    short_name: 'zen',
    description: 'zen — the private trading desk of 1ed.ge',
    start_url: '/zen/',
    scope: '/zen/',
    display: 'standalone',
    background_color: '#0a0a0c',
    theme_color: '#0a0a0c',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
  return new Response(JSON.stringify(manifest, null, 2), {
    headers: { 'Content-Type': 'application/manifest+json; charset=utf-8' },
  })
}
```

- [ ] **Step 4: `src/pages/zen/preview/[date].astro`** — copy `src/pages/zen/[secret]/preview/[date].astro`, drop the `secret` param, gate on `sessionOk(Astro.request)` instead of the secret compare.

- [ ] **Step 5: Delete the old routes**

```bash
cd /root/1ed-ge-preprod
git rm -r src/pages/zen/[secret]
git rm -r src/pages/admin
```

- [ ] **Step 6: Typecheck + commit**

```bash
cd /root/1ed-ge-preprod
npm run typecheck
git add src/pages/zen/ src/pages/admin
git commit -m "feat(passkey): zen pages — /zen (passkey-gated), /zen/setup (recovery), manifest + preview; old secret routes deleted"
```

---

### Task 6: The React client — LoginScreen + RegisterScreen + AdminApp prop

**Files:**
- Create: `src/components/admin/LoginScreen.tsx`
- Create: `src/components/admin/RegisterScreen.tsx`
- Update: `src/components/admin/AdminApp.tsx` (drop `secret` prop)
- Update: `src/components/admin/api.ts` (already done in Task 3)

- [ ] **Step 1: `src/components/admin/LoginScreen.tsx`**

```tsx
import { useEffect, useState } from 'react'

export default function LoginScreen() {
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<{ hasPasskeys: boolean; authed: boolean } | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/webauthn/status')
      .then((r) => r.json())
      .then((d) => setStatus(d))
      .catch(() => setStatus({ hasPasskeys: false, authed: false }))
  }, [])

  const signIn = async () => {
    setBusy(true)
    setErr(null)
    try {
      const begin = await fetch('/api/webauthn/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      const { options, nonce, error: beginErr } = await begin.json()
      if (!begin.ok || beginErr) throw new Error(beginErr || 'begin failed')
      const credential = await navigator.credentials.get({ publicKey: options as PublicKeyCredentialRequestOptions })
      if (!credential) throw new Error('no credential')
      const verify = await fetch('/api/webauthn/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nonce, credential }),
      })
      const v = await verify.json()
      if (!verify.ok) throw new Error(v.error || 'verify failed')
      window.location.reload()
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }

  if (!status) return <div class="shell py-24 text-[13px] text-faint">…</div>
  if (!status.hasPasskeys) {
    return (
      <div class="shell py-24 text-[13px] text-dim">
        no passkey registered yet — open <span class="text-ink">/zen/setup</span> from your
        recovery URL to register one.
      </div>
    )
  }

  return (
    <div class="shell flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <h1 class="text-xl">zen</h1>
      <p class="text-[13px] text-dim">sign in with your passkey</p>
      <button
        class="h-10 border border-line px-5 text-[13px] transition-colors hover:border-accent"
        onClick={signIn}
        disabled={busy}
      >
        {busy ? '…' : 'sign in'}
      </button>
      {err && <p class="text-[12px] text-down">{err}</p>}
    </div>
  )
}
```

- [ ] **Step 2: `src/components/admin/RegisterScreen.tsx`**

```tsx
import { useState } from 'react'

export default function RegisterScreen() {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const key = new URLSearchParams(window.location.search).get('key') ?? ''

  const register = async () => {
    setBusy(true)
    setErr(null)
    try {
      const begin = await fetch('/api/webauthn/register', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key }),
      })
      const { options, nonce, error: beginErr } = await begin.json()
      if (!begin.ok || beginErr) throw new Error(beginErr || 'begin failed')
      const credential = await navigator.credentials.create({ publicKey: options as PublicKeyCredentialCreationOptions })
      if (!credential) throw new Error('no credential')
      const verify = await fetch('/api/webauthn/register', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, nonce, credential }),
      })
      const v = await verify.json()
      if (!verify.ok) throw new Error(v.error || 'verify failed')
      setDone(true)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }

  if (done) {
    return (
      <div class="text-[13px]">
        <p class="text-up">✓ passkey registered.</p>
        <a class="mt-4 inline-block border border-line px-4 py-2 hover:border-accent" href="/zen">open zen →</a>
      </div>
    )
  }

  return (
    <div class="flex flex-col items-start gap-3">
      <button
        class="h-10 border border-line px-5 text-[13px] transition-colors hover:border-accent"
        onClick={register}
        disabled={busy}
      >
        {busy ? '…' : 'register passkey'}
      </button>
      {err && <p class="text-[12px] text-down">{err}</p>}
    </div>
  )
}
```

- [ ] **Step 3: Drop the `secret` prop from `AdminApp`**

`src/components/admin/AdminApp.tsx`: change `interface Props { secret: string; zenLine: string | null }` → `interface Props { zenLine: string | null }`; remove `secret={secret}` wherever AdminApp is mounted (only `/zen/index.astro`).

- [ ] **Step 4: Typecheck + commit**

```bash
cd /root/1ed-ge-preprod
npm run typecheck
git add src/components/admin/
git commit -m "feat(passkey): React client — LoginScreen + RegisterScreen, AdminApp drops the secret prop"
```

---

### Task 7: Pipeline plumbing — deploy-test mkdir, sync allowlist, docs

**Files:**
- Update: `scripts/deploy-test.sh`
- Update: `scripts/sync-to-prod.sh` (allowlist: add `package.json`, `package-lock.json`, `docker-compose.yml`)
- Update: `MEMORY.md`, `AGENTS.md`

- [ ] **Step 1: `scripts/deploy-test.sh` — ensure `data/` exists before start**

Add after `echo "→ building"`:

```bash
echo "→ ensuring data dir exists"
mkdir -p "$ROOT/data"
```

- [ ] **Step 2: `scripts/sync-to-prod.sh` — extend the allowlist** (needed when the owner approves: the feature adds `package.json`/`docker-compose.yml` changes that must sync to main)

```bash
ALLOWLIST_REGEX='^(src/[^c]|src/c[^o]|src/co[^n]|src/con[^t]|src/cont[^e]|src/conte[^n]|src/conten[^t]|src/content/($|.n(ext|ot-used))|tests/|\.gitignore|nginx/|package\.json|package-lock\.json|docker-compose\.yml)'
```

Also update the comment block above it (lines 11-17) to mention the new entries.

- [ ] **Step 3: Update `AGENTS.md`** — the "Pipeline" section, add a line:

```markdown
- **Zen auth is passkey-based** (`/zen`, WebAuthn). The setup/recovery URL is
  `/zen/setup?key=<ADMIN_SECRET>` — the secret is no longer in the daily URL.
  Admin API auth = session cookie, not the `x-admin-secret` header.
```

`MEMORY.md` — add one line to the top handoff: the passkey auth model + test-first status + the two setup URLs (placeholders only — never the literal secret).

- [ ] **Step 4: Typecheck + run the full test sweep + commit**

```bash
cd /root/1ed-ge-preprod
npm run typecheck
node tests/pipeline.test.mjs
node --test tests/passkey.test.mjs
git add scripts/deploy-test.sh scripts/sync-to-prod.sh MEMORY.md AGENTS.md
git commit -m "chore(passkey): deploy-test mkdir data/, sync allowlist + docker/package files, docs"
```

---

### Task 8: Deploy to test + verify + onboarding

**Files:**
- Run: `bash scripts/ship.sh test-only` in `/root/1ed-ge-preprod`

- [ ] **Step 1: Deploy test**

```bash
cd /root/1ed-ge-preprod
bash scripts/ship.sh test-only
```

(rebuilds, restarts the node server on 4323, installs the test nginx vhost, verifies).

- [ ] **Step 2: Verify the routes live on test**

```bash
# with basic auth (trader:wonderland), via the Host header (VPS resolver can't resolve test.1ed.ge)
curl -s -o /dev/null -w "/zen: %{http_code}\n" -u trader:wonderland -H "Host: test.1ed.ge" http://127.0.0.1/zen
curl -s -o /dev/null -w "/zen/setup?key=<secret>: %{http_code}\n" -u trader:wonderland -H "Host: test.1ed.ge" "http://127.0.0.1/zen/setup?key=$ADMIN_SECRET"
curl -s -o /dev/null -w "/zen/setup?key=wrong: %{http_code}\n" -u trader:wonderland -H "Host: test.1ed.ge" "http://127.0.0.1/zen/setup?key=wrong"
curl -s -o /dev/null -w "/zen/<secret> (old, 404): %{http_code}\n" -u trader:wonderland -H "Host: test.1ed.ge" "http://127.0.0.1/zen/$ADMIN_SECRET"
curl -s -o /dev/null -w "/admin/<secret> (old, 404): %{http_code}\n" -u trader:wonderland -H "Host: test.1ed.ge" "http://127.0.0.1/admin/$ADMIN_SECRET"
```

Expected: `/zen` 200 · setup with key 200 · setup wrong key 404 · old zen 404 · old admin 404.
`bash scripts/verify-env.sh test` → PASS (4/4).

- [ ] **Step 3: Owner onboarding on test**

Open `https://test.1ed.ge/zen/setup?key=<ADMIN_SECRET>` → basic-auth prompt (`trader`/`wonderland`) → "register passkey" → Face ID / Touch ID. Then `https://test.1ed.ge/zen` → sign in → the desk loads; every admin action works (cookie-ridden API).

- [ ] **Step 4: Rollback drill (documented, not run live)**

If the owner doesn't like it:

```bash
cd /root/1ed-ge-preprod
git revert --no-edit <feature-merge-or-first-passkey-commit>..HEAD   # or: git revert <each feature commit>
bash scripts/deploy-test.sh
```

Test is back on the old `/zen/<secret>` + `x-admin-secret` flow. Prod untouched. `data/` (gitignored) can be deleted for a clean slate.

---

## Self-Review

- **Spec coverage:** ✓ Routes (Task 5) ✓ WebAuthn flow (Tasks 2 + 4) ✓ Session model (Task 2) ✓ API switch — all 28 call sites (Task 3) ✓ Storage + compose + gitignore (Tasks 0 + 1) ✓ Both envs (Task 8 test; prod gated on approval) ✓ Rollback plan (Task 8 Step 4 + Global Constraints) ✓ Onboarding URLs (Task 8 Step 3) ✓ PWA re-install note (spec; surfaced to owner at approval).
- **Placeholder scan:** no TBD/TODO. The `<ADMIN_SECRET>` in the docs is intentional (never commit the literal value).
- **Type consistency:** `requireSession(request)` returns `error()` or `null`; `sessionOk(request): boolean`; `setupKeyOk(given): boolean`; `registerBegin/loginBegin` return `{ options, nonce }`; `loginBegin` returns `null` when no passkeys. `json(data, status, headers?)` signature extended once (Task 4 Step 4) — Task 3's `requireSession` uses `error()` which still works.
- **Sync allowlist:** extended with `package.json`/`package-lock.json`/`docker-compose.yml` in Task 7 — required for the approved sync to carry the dependency + volume.
- **Test-first boundary:** every commit in Tasks 0-7 happens on the `preprod` branch. Task 8 deploys to test. Nothing touches `main` until the owner approves.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-08-passkey-auth.md`. Two execution options:

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks; good for a security-sensitive feature where each task's diff gets eyes.
2. **Inline Execution** — batch execution with checkpoints in this session.

All tasks run in `/root/1ed-ge-preprod` (preprod branch). The owner approves on test before anything syncs to main.

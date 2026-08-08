# Passkey auth for zen (design)

**Status: design — awaiting owner review.**

The owner's ask: access the private zen area via **passkeys** stored on iOS /
MacBook (iCloud Keychain, Face ID / Touch ID), replacing the secret-based URL.
**This is a test-first rollout** — the owner wants to try it on `test.1ed.ge`
first and must be able to **roll back** if it isn't right. Prod ships only
after approval on test.

## Goal

- `/zen` becomes the stable, passkey-gated entry to the private desk (no secret
  in the URL). Face ID / Touch ID / iCloud Keychain proves the owner.
- The old `ADMIN_SECRET` becomes a **one-time setup key** — used once to
  register the first passkey, then only for recovery (re-register if the
  passkey is lost).
- The admin API switches from the `x-admin-secret` header to a **signed session
  cookie** (long-lived, sliding).
- Passkeys work on **both** envs (separate registrations per origin —
  passkeys are origin-bound, so the prod credential can't auth on test).
- **Test-first:** the whole feature ships to the preprod branch + test.1ed.ge
  first. If the owner doesn't like it, roll back = revert the commits on
  preprod + redeploy test. Prod is untouched until approval.

## Design decisions (owner, 2026-08-08)

1. **Passkey replaces the secret.** Zen moves to `/zen`; the secret URL dies.
2. **Session cookie for API auth** (httpOnly, Secure, SameSite=Lax, sliding).
3. **Secret as hidden recovery key** — `/zen/setup?key=<ADMIN_SECRET>` is the
   only place the secret is used (first registration + recovery).
4. **One passkey, iCloud-synced** (register once, works on iPhone + MacBook +
   iPad sharing one Apple ID).
5. **Passkey on both envs** (separate registrations per origin).
6. **Secret URL = setup page** for the first-passkey bootstrap.
7. **Long-lived sliding session** (~30 days, each API call refreshes expiry).
8. **Library: `@simplewebauthn/server`** (the de-facto standard; WebAuthn
   crypto — CBOR, attestation, signatures, counters — is too subtle to hand-roll).

## Routes

| Route | Gate | Purpose |
|---|---|---|
| `/zen` | Passkey session cookie | The daily desk — stable URL, no secret |
| `/zen/setup` | `?key=<ADMIN_SECRET>` | One-time first registration + recovery |
| `/zen/manifest.webmanifest` | Passkey session cookie | PWA manifest (`start_url: /zen/`) |
| `/zen/preview/[date]` | Passkey session cookie | Day preview (moves off the secret) |
| `/zen/[secret]` (old) | — | **Removed — 404** |
| `/admin/[secret]` (old) | — | **Removed — 404** (was a thin redirect) |

The existing PWA installs on the owner's devices have `start_url:
/zen/<secret>/`; after this ships the manifest moves to `/zen/`, so the owner
**re-installs the PWA** (delete + Add to Home Screen).

## WebAuthn flow (`@simplewebauthn/server`)

**Registration** — only via the setup page:

1. `GET /zen/setup?key=<secret>` → server validates the key (constant-time),
   renders a "register passkey" screen.
2. `POST /api/webauthn/register/begin` `{ key }` → server returns
   `{ options }`: challenge, `rp { id, name }`, `user { id, name }`,
   `pubKeyCredParams`, `authenticatorSelection { residentKey: "required",
   userVerification: "required" }`, `attestation: "none"`.
3. Browser calls `navigator.credentials.create({ publicKey })` → Face ID /
   Touch ID prompt → returns the credential.
4. `POST /api/webauthn/register/verify` `{ key, credential }` → server
   verifies the response against the stored challenge, **saves the credential
   to `data/passkeys.json`**, clears all active sessions (revocation).

**Login** — on `/zen` when not authenticated:

1. `GET /api/webauthn/status` → `{ hasPasskeys, authed }`. `/zen` renders the
   login screen when `!authed`, the React desk when `authed`.
2. `POST /api/webauthn/login/begin` → server returns `{ options }` with the
   challenge + `allowCredentials` (the stored credential IDs).
3. Browser calls `navigator.credentials.get({ publicKey })` → Face ID /
   Touch ID prompt.
4. `POST /api/webauthn/login/verify` `{ credential }` → server verifies the
   signature + counter, sets the **session cookie**, returns `{ ok: true }`.
5. The React app boots; every API call rides the cookie.

**Logout** — `POST /api/webauthn/logout` deletes the session token + clears
the cookie.

**Status** — `GET /api/webauthn/status` returns `{ hasPasskeys, authed }`
(no secrets; drives the `/zen` render decision).

## Session model

- Cookie `zen_session` = a random 256-bit opaque token (`crypto.randomUUID` +
  `crypto.randomBytes(32)`), httpOnly, Secure, SameSite=Lax, `Path=/`,
  max-age 30 days.
- Token stored in `data/sessions.json` as `{ token, createdAt, expiresAt }`.
- **Sliding:** every authenticated API call refreshes `expiresAt` (30 days
  from now) and re-sets the cookie.
- **Logout** deletes the token; **re-register** clears all tokens (old
  passkey stops working immediately).
- `sessionOk(request)`: constant-time token compare + expiry check.

## API auth switch

- `src/lib/auth.ts` gains `sessionOk(request)` (+ cookie helpers). The old
  `authorized(request)` (x-admin-secret header) is **deleted**.
- All **28 call sites** across the 15 admin API files switch from
  `authorized(request)` to `sessionOk(request)` (same `error('unauthorized',
  401)` shape).
- `src/components/admin/api.ts` drops the `x-admin-secret` header (same-origin
  fetch sends the cookie automatically).
- `AdminApp` loses the `secret` prop; `/zen` index.astro no longer passes it.

## Storage (files-as-database, consistent with the site)

- `data/passkeys.json` — the credential record(s): `{ id, publicKey, counter,
  transports, createdAt }` (public-key material only — safe on disk).
- `data/sessions.json` — active session tokens.
- `data/` is **gitignored** and **bind-mounted** into the docker container
  (docker-compose adds `./data:/app/data`). Survives container restarts and
  deploys. The preprod's `node dist/server/entry.mjs` runs on the host — same
  path, no container needed.
- `data/` created on first write (`fs.mkdirSync(dir, { recursive: true })`,
  same pattern as `src/lib/content.ts`).

## Env / deploy

- **Test** (`test.1ed.ge`): ships first. Its nginx basic-auth layer
  (`trader`/`wonderland`) stays on top (defence in depth for the sandbox) —
  the passkey flow sits behind it. Separate registration (origin-bound).
- **Prod** (`1ed.ge`): ships only after owner approval on test. Its own
  registration.
- Pipeline scripts unchanged. The passkey store is env-local (gitignored,
  never synced between worktrees).

## Rollback plan (test-first — the owner's hard requirement)

**The feature is developed on the `preprod` branch only.** Prod (main) is not
touched until the owner approves on test. Therefore:

- **If the owner doesn't like it:** `git revert` the passkey commits on the
  preprod branch (one revert commit or a revert of the feature merge), then
  `bash scripts/deploy-test.sh`. Test.1ed.ge is back on the old secret URL +
  basic auth + the old `x-admin-secret` API flow.
- **Data residue:** `data/` is gitignored, so a revert doesn't drag any
  credential files into git. The registered passkeys sit unused in the
  (gitignored) `data/` dir — harmless; delete the dir if a clean slate is
  wanted.
- **Prod safety:** main never receives the feature until approval. The
  existing ship.sh / sync guards already enforce this.
- **PWA:** if rolled back, the re-installed PWA points at `/zen/` which 404s
  under the old code — re-install again (or use the old `/zen/<secret>/`
  start_url, which the revert restores). Note this to the owner.

## Onboarding (the two URLs)

Both envs currently share the same `ADMIN_SECRET` (in each worktree's
gitignored `.env` — the literal value is intentionally NOT written here; it
lives in `.env` and in the owner's head/bookmarks).

- **Test (first — this is the rollout order):**
  `https://test.1ed.ge/zen/setup?key=<ADMIN_SECRET>`
  (the nginx basic-auth prompt comes first: `trader` / `wonderland`).
- **Prod (only after approval on test):**
  `https://1ed.ge/zen/setup?key=<ADMIN_SECRET>`

Owner flow: open the setup URL → tap "register passkey" → Face ID / Touch ID →
done. From then on `/zen` is passkey-gated; the secret is no longer needed
except for recovery.

## File-by-file change list

**New:**

- `src/pages/zen/index.astro` — the stable passkey-gated zen page (replaces
  `src/pages/zen/[secret]/index.astro`). Checks `sessionOk`; renders a
  LoginScreen or the React desk.
- `src/pages/zen/setup.astro` — the setup/recovery page (key-gated).
- `src/pages/zen/manifest.webmanifest.ts` — manifest at `/zen/`
  (session-gated, `start_url: /zen/`).
- `src/pages/zen/preview/[date].astro` — moves off the secret, session-gated.
- `src/pages/api/webauthn/register.ts` — `begin` + `verify` handlers.
- `src/pages/api/webauthn/login.ts` — `begin` + `verify` handlers.
- `src/pages/api/webauthn/logout.ts` — logout.
- `src/pages/api/webauthn/status.ts` — `{ hasPasskeys, authed }`.
- `src/lib/webauthn.ts` — server-side WebAuthn logic (`@simplewebauthn/server`
  wrappers: registration verification, login verification, credential
  storage read/write, session issue/validate).
- `src/lib/passkeys.ts` — `data/passkeys.json` read/write + session
  store helpers (or fold into `webauthn.ts`).
- `src/components/admin/LoginScreen.tsx` — the passkey login UI (client,
  React — the zen area already is React).
- `data/` — gitignored credential + session store (created at runtime).
- `tests/passkey.test.mjs` — unit tests for the auth/webauthn helpers.

**Updated:**

- `src/lib/auth.ts` — add `sessionOk(request)` + cookie helpers; remove
  `authorized(request)`.
- 15 admin API files — swap `authorized(request)` → `sessionOk(request)`
  (28 call sites).
- `src/components/admin/api.ts` — drop the `x-admin-secret` header.
- `src/components/admin/AdminApp.tsx` — drop the `secret` prop.
- `docker-compose.yml` — add `./data:/app/data` volume.
- `.gitignore` — add `data/`.
- `package.json` — add `@simplewebauthn/server`.
- `MEMORY.md` / `AGENTS.md` — note the passkey auth model + the setup URL.
- `scripts/deploy-test.sh` — mkdir `data/` before start (host node runs with
  cwd = worktree root, so `data/` is local; just ensure it exists).

**Removed:**

- `src/pages/zen/[secret]/index.astro`
- `src/pages/zen/[secret]/manifest.webmanifest.ts`
- `src/pages/zen/[secret]/preview/[date].astro`
- `src/pages/admin/[secret]/index.astro`

## Verification

- `node tests/passkey.test.mjs` — registration + login verification helpers
  (challenge issue/verify, credential store, session issue/validate/expire).
- `npm run typecheck` — 0 errors.
- Test deploy: `bash scripts/ship.sh test-only` → verify:
  - `curl -sI https://test.1ed.ge/zen` → 200 + noindex (after basic auth).
  - `curl -sI https://test.1ed.ge/zen/setup?key=<secret>` → 200.
  - `curl -sI https://test.1ed.ge/zen/setup?key=wrong` → 404.
  - Old `/zen/<secret>` and `/admin/<secret>` → 404.
  - Owner registers the passkey on test → `/zen` opens with Face ID, React
    desk boots, API calls succeed (cookie-ridden).
- Rollback drill (dry): revert the feature commit on preprod → deploy-test →
  `/zen/<secret>` returns again. (Run in a scratch worktree, not live, or
  document the exact revert + redeploy steps.)
- Prod: untouched until approval.

## Risks + mitigations

- **Risk:** the owner loses the passkey (device wipe / iCloud issue).
  **Mitigation:** the setup URL (secret-gated) re-registers a new passkey;
  recovery is one URL away, documented in AGENTS.md.
- **Risk:** session hijack (device stolen while logged in, 30-day window).
  **Mitigation:** httpOnly + Secure cookie, SameSite=Lax; logout button;
  re-registering a passkey clears all sessions. 30-day sliding is the
  owner's accepted trade-off (daily-use private desk).
- **Risk:** rollback needed. **Mitigation:** the feature lives on preprod
  only until approval; revert + redeploy restores the old flow; `data/` is
  gitignored so no credential residue enters git.
- **Risk:** the PWA install breaks (start_url moves). **Mitigation:** note in
  the spec + tell the owner to re-install; rollback restores the old start_url.
- **Risk:** WebAuthn subtlety (attestation formats, counters, CBOR).
  **Mitigation:** `@simplewebauthn/server` (battle-tested); `attestation:
  "none"` (simplest valid path for a single-user site); counter updated on
  every login (clone detection).
- **Risk:** test env basic auth + passkey = two gates on test only.
  **Mitigation:** intended (sandbox defence in depth); prod has only the
  passkey.

## Out of scope (parked)

- Multi-user auth.
- Backup/recovery codes (the setup URL is the recovery).
- Passkey management UI beyond the setup page (list + re-register).
- Touch ID on macOS Safari quirks (deferred; the standard
  `navigator.credentials` path covers Face ID / Touch ID / passcode via the
  platform authenticator).
- Moving `/zen` behind Cloudflare Access or similar.

## See also

- `docs/PIPELINE.md` — the env contract the rollout follows
- The 7 owner decisions above (this file's "Design decisions" section)

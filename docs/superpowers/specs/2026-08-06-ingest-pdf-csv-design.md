# Ingest: PDF / CSV / Image trade import — design

**Date:** 2026-08-06 · **Status:** SHIPPED — deployed + verified live (2026-08-08)
**Owner:** sole trader (single user). Everything here was validated against the
owner's real Tradovate exports (files still in `/tmp/opencode/import-demo/`).

---

## 1. The requirement (owner, verbatim intent)

A **daily drag-and-drop ritual**: the owner throws trade screenshots, CSVs, and
PDFs into the cockpit drop zone. The AI parses + dedupes the data intelligently
and proposes trades + account updates. **The owner approves every trade** before
it goes live (day records + accounts). Source files are ephemeral — discarded
after extraction, like screenshots. This is a daily action, not a weekly bulk
import.

## 2. Confirmed facts (from the live demo)

- **Owner's real accounts: 2 × Lucid 50k.** Tradovate platform ids:
  `LTE05061295040002`, `LTE05061295040003`. Trade MNQ scalps, up to 25
  contracts, ~30 per-fill "trades" per account per day, 80% win rate,
  ~$306 net/day each. Only the admin account list is truth.
- **Tradovate exports carry NO firm, NO account size, NO equity/balance.**
  They contain only: platform account id, fills (price/qty/time), and P&L.
  The platform account id (`LTE…`) is the **only join key** to internal
  accounts.
- **Export formats (Tradovate):**
  - `Performance` CSV/PDF: per-fill round-trip trades (symbol, qty, buy/sell
    price+time, $P&L) with summary stats (gross/net P&L, win rate, expectancy).
    **Has NO account id.**
  - `Orders` CSV/PDF: order fills with the **account id** column + order ids.
- **Cross-referencing:** to attribute a Performance file to an account, join by
  fill/order IDs against the Orders file (demo: `611527…` ↔ `…0002`,
  `611530…` ↔ `…0003`).
- **Dedup rules (validated):** the two accounts run the *same* copy-traded
  strategy — near-identical trades — and must **NOT** collapse into one.
  But each account's CSV **and** PDF are the *same data* and must import once.
  So dedup is **per-account**, keyed by a fill/position fingerprint.
- **"Trade" semantics:** the platform counts per-contract round-trips (~30/day).
  As journal *ideas* (one setup + `size` + executions), those collapse to ~4
  positions (e.g. a 25-lot scaled exit = 25 fills = ONE position). Grouping
  fills → positions is required, or the journal looks like overtrading.

## 3. Design rules (decided)

1. **Platform-id → internal-id alias map.** On first import of an unknown
   platform id, the AI **proposes** an internal account (firm + size inferred
   from contract/trade-size + the admin account list) and the owner **confirms
   once**; the mapping persists (e.g. `LTE05061295040002 → lucid-50k-a`) and
   every future drop auto-maps. Never silently guesses.
2. **Approve every trade.** Parsed trades land in a review queue; the owner
   approves/edits/discards each. High-confidence near-duplicates are pre-flagged.
3. **Group per-fill → position/idea** for the day record (trades model:
   market/direction/session/setup/entry/stop/exit/points/riskPoints/
   executions[{account,size}]).
4. **Ephemeral sources** — image/CSV/PDF held in a temp buffer during parsing,
   then discarded. Never saved, never public.
5. **Reuse the existing account flow** — `src/lib/ai.ts readStatement()` +
   `src/pages/api/admin/accounts.ts` already do statement→account (stage,
   equity note, auto-payout). Extend them to also write the parsed trades into
   `days/<date>.md` (creating missing day records).

## 4. Technical notes

- **PDF reading:** no PDF tooling on the box. The host now has `poppler-utils`
  installed (used for the demo). The **Dockerfile must add
  `RUN apk add --no-cache poppler-utils`** for the real pipeline. Plan:
  `pdftotext` for the cheap text path; render pages to PNG via `pdftoppm` and
  read with the vision model (Qwen2.5-VL) when tables are hard — vision on
  rendered pages is the proven path for statements.
- **CSV:** deterministic tiny parser (no dep) → header + rows → LLM
  (DeepSeek) maps columns to the trade schema and outputs structured trades +
  account match. P&L is in $ → points via account `pointsValue` (MNQ = 2)
  or computed from entry/exit when present.
- **Images:** existing `structureDayFull`/`readScreenshot` path (vision).
  Covers "a screenshot *of* a CSV/table" too.
- **API:** new auth'd endpoint (e.g. `POST /api/admin/ingest`) accepting a
  base64 file (image/csv/pdf) + name; returns the parse proposal. Follows the
  `x-admin-secret` pattern of the existing admin APIs.
- **Day-record writes:** reuse `src/lib/content.ts` `writeEntry('days', …)`
  and the days API save semantics; queue a pending change for rebuild.

## 5. Where it plugs in

- The cockpit **extract drop zone** (currently hidden from the public render —
  see `src/components/cockpit/RailRight.astro`) becomes the author-only ingest
  surface, accepting any file type. Auth-gating arrives with the P3 compose
  island / SSR day page.
- This is **P3's "extract" half** plus the account-update half that already
  exists in the admin Accounts tab. Scope it as its own phase; the owner wants
  it executed, not re-designed.

## 6. Next steps for the next agent

1. Write the implementation plan (`docs/superpowers/plans/…`). Add poppler to
   the Dockerfile first (needs a rebuild + redeploy).
2. Build `parseTradeFiles(files, ctx)` in `lib/ai.ts` (or a new `lib/ingest.ts`):
   normalize (image/csv/pdf) → LLM/vision → `{ trades[], accountProposal, dupes }`.
3. Build the review queue UI (author-only) + `POST /api/admin/ingest` + apply
   (day records + account updates + auto-payout) + pending-change.
4. Ship it per AGENTS.md (typecheck → e2e → build → deploy → curl-verify).

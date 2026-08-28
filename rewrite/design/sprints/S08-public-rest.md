# S08 — Public rest (archive, performance, models, about)

Goal: the drill-down surfaces, consolidated from ~16 legacy routes to five.

## Scope
1. `design/mocks/public/day.html` — single day: facts strip, trades full
   tickets, stream, reflection (published only), news; prev/next day nav.
2. `design/mocks/public/period.html` — week/month/quarter rollup: R curve,
   per-account table, habit adherence heat, narrative review text;
   period switcher (segmented).
3. `design/mocks/public/performance.html` — canonical stats page: equity
   (portfolio + per account), drawdown, R distribution, win-rate/factor,
   by-setup and by-model breakdowns. Absorbs tracker/trends/accounts-stats.
4. `design/mocks/public/models.html` — trading models w/ premise + rule
   library + quotes (the "how he thinks" page).
5. `design/mocks/public/about.html` — the experiment explained, accountability
   rules, colophon; links to everything public. No admin hints.

## Acceptance checklist
- [ ] prev/next day nav works with keyboard arrows on desktop too
- [ ] performance tables readable at 375px without horizontal page scroll
- [ ] every number appears exactly once per view (facts-once rule)
- [ ] all charts SVG/div based; no JS frameworks; lightbox dialog only
- [ ] IA map in BRIEF updated if consolidation changes
- [ ] board + resume protocol followed

## Out of scope
RSS/sitemap (trivial, build phase), search UI (zen-only for now).

## Session log

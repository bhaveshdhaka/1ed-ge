---
description: Scaffold a new prop-firm account instance.
---

Create `src/content/accounts/<id>.md` for a new account instance (each instance
is one lifecycle: eval → buffer → payout → failed/paused). Ask for and fill:
id (e.g. lucid-50k-b), firm, size, sizeLabel, drawdownLimit, trailing, contract
(MNQ), pointsValue (2), riskPerTrade, stage (start `eval`), stages[] history.
Match the frontmatter shape in `src/content/accounts/lucid-50k-a.md` and the
Zod schema in `src/content.config.ts`. Do not invent values — ask the user.

---
description: Scaffold a new prop-firm account file.
---

Create `src/content/accounts/<slug>.md` for a new prop account with a name
matching `$ARGUMENTS`. Ask for and fill: firm, size, sizeLabel, drawdownLimit,
trailing, contract (MNQ), pointsValue (2), riskPerTrade, status, started.
Match the frontmatter shape in `src/content/accounts/tpt-25k.md` and the Zod
schema in `src/content.config.ts`. Do not invent values — ask the user.

---
description: Structure raw trade notes into the 1ed.ge trade template.
agent: build
---

Take the raw trade notes and produce the trade frontmatter for
`src/content/trades/<date>-NNN.md` per the schema in `src/content.config.ts`:

date, account (must be an existing account slug from `src/content/accounts/`),
market, session (asia/london/ny-am/ny-pm/ny), direction (long/short), setup,
entry, stop, target, exit, riskPoints, points, confidence (1-5), screenshots
(usually empty), note (one line).

Compute `riskPoints = |entry - stop|` and, if missing, `points` from exit/entry
and direction. Do not write the file unless the user asks — show the result
first. Input: `$ARGUMENTS`

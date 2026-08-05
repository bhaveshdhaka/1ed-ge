---
description: Structure raw trade notes into the 1ed.ge day-log model.
agent: build
---

Take the raw trade notes and produce the `trades[]` entries for
`src/content/days/<date>.md` per the schema in `src/content.config.ts`.

Each trade (idea) has: market, session (asia/london/ny-am/ny-pm/ny), direction
(long/short), setup, entry, stop, target, exit, points, riskPoints,
confidence (1-5), note, executions[] (account ids from `src/content/accounts/`,
each optional size). Also include day-level mood/sleep if inferable.

Compute `riskPoints = |entry - stop|` and, if missing, `points` from exit/entry
and direction. Do not write the file unless the user asks — show the result
first. Input: `$ARGUMENTS`

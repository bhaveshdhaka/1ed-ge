---
description: Add a CHANGELOG entry and tag a release.
---

Add an entry to `CHANGELOG.md` under the current Unreleased section (or create
one), following Keep a Changelog and SemVer: `$ARGUMENTS`. Use
`### Added`, `### Fixed`, `### Changed`, `### Removed` as needed.

When the change is meaningful and the user agrees, bump `version` in
`package.json`, move the Unreleased block under a `## [x.y.z] - YYYY-MM-DD`
heading, commit (`chore(release): vX.Y.Z`), and tag `vX.Y.Z`.
Ask before tagging if unsure.

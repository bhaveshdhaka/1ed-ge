---
description: Commit changes with a conventional message.
---

Commit the working tree with a conventional message. Context: `$ARGUMENTS`.

- Code changes: `feat:` / `fix:` / `chore:` / `docs:` — e.g. `feat(trades): …`.
- Content only: `content: …` (the cron uses `chore(content): autosave` — keep
  manual content commits distinct).
- Never stage `.env` or any secret. Check `git status` first and stage only
  intended files.

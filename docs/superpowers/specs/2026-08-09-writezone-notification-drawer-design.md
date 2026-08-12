# Unified WriteZone + Notification Drawer — Design

> **Date:** 2026-08-09
> **Status:** Owner-approved ("yep lets do this and iterate")

## The essence

The /zen day workspace becomes a single no-distraction writing surface. One `WriteZone` panel replaces ThoughtsSurface + ReflectionZone. A `NotificationDrawer` in the header replaces the RebuildBar, status text, and ObligationChip. The check-in band stays as a compact strip above.

## 1. WriteZone — unified writing panel

One panel, one textarea. A type selector changes what the textarea becomes:

| Type | Textarea | Extra fields | Publish action |
|------|----------|-------------|----------------|
| **thought** | Normal textarea | — | Adds to stream |
| **quote** | Normal textarea | Author input below | Adds to stream with author |
| **trade** | Normal textarea (commentary) | Trade form (market, dir, entry, exit, etc.) | Adds trade + stream entry |
| **reflection** | Tall textarea | — | Publishes to journal |

Below the composer: a compact list of published thoughts (timestamp + type + preview).

**Files:**
- Create: `src/components/admin/WriteZone.tsx`
- Delete: `src/components/admin/ThoughtsSurface.tsx`
- Delete: `src/components/admin/ReflectionZone.tsx`
- Modify: `src/components/admin/tabs/DayWorkspace.tsx`

## 2. NotificationDrawer — replaces RebuildBar + status chrome

A subtle indicator in the /zen header (next to ⌘K). Shows count of pending items. Click opens a compact drawer.

**Section 1: Pending reflections**
- Overdue daily reflections (past Mon-Fri days without journal post)
- Due-tonight reflection (current day in grace period)
- Period reviews not yet written

**Section 2: Site updates**
- Pending changes count + "rebuild to publish" button
- Current day publish status

**What this replaces (remove from current locations):**
- RebuildBar.tsx (entire component)
- Status text in DayWorkspace header ("● unsaved draft / ● published")
- ObligationChip from ReflectionZone

**Files:**
- Create: `src/components/admin/NotificationDrawer.tsx`
- Delete: `src/components/admin/RebuildBar.tsx`
- Delete: `src/components/admin/ObligationChip.tsx`
- Modify: `src/components/admin/AdminApp.tsx` (add NotificationDrawer to header)
- Modify: `src/components/admin/tabs/DayWorkspace.tsx` (remove status text, remove RebuildBar usage)

## 3. Simplified DayWorkspace layout

```
┌──────────────────────────────────────┐
│  / day · 09-aug-2026  [🔔 3] [⌘K]   │
├──────────────────────────────────────┤
│  ☀️ [calm]  🌙 [7.5h · rested]       │
│  📱 iphone 5.2h · social 2.4h · mac  │
│  ✅ [quiet-time] [read] [library ▸]  │
├──────────────────────────────────────┤
│  ┌─ write ─────────────────────────┐  │
│  │ [thought] [quote] [trade] [reflection] │
│  │ ┌──────────────────────────┐    │  │
│  │ │ write your thought…      │    │  │
│  │ └──────────────────────────┘    │  │
│  │                    [publish]    │  │
│  └──────────────────────────────────┘  │
│                                        │
│  ● published (3)                       │
│  ┌─ 08:30 · thought ────────────────┐  │
│  │ news tonight — flat 15 before    │  │
│  └──────────────────────────────────┘  │
│  ┌─ 09:15 · trade ▲ MNQ +0.82R ────┐  │
│  │ ORB · ny-am                      │  │
│  └──────────────────────────────────┘  │
├──────────────────────────────────────┤
│  day · +0.82R · 2 trades · 4/6 habits │
└──────────────────────────────────────┘
```

## 4. Verification

- `npm run typecheck` — 0 errors
- `node --import tsx --test "tests/**/*.test.ts"` — all pass
- `npm run build` — succeeds
- Live curl: post a thought, verify it appears on / and /stream
- Deploy preprod → verify → sync to prod → verify
", "filePath": "/root/1ed-ge-preprod/docs/superpowers/specs/2026-08-09-writezone-notification-drawer-design.md"}
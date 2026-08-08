import type { DayEntry, HabitEntry } from './stats'
import { addDaysIso, todayHkt } from './sessions'

export interface HabitStat {
  id: string
  name: string
  emoji?: string
  color: string
  description?: string
  done: number
  logged: number
  pctAll: number | null
  pct30: number | null
  currentStreak: number
  bestStreak: number
  doneToday: boolean | null
  last7: (boolean | null)[]
  heatmap: { date: string; value: boolean | null }[]
}

/**
 * Habit stats over plain `YYYY-MM-DD` keys (HKT day = calendar day). `todayIso`
 * is injected (defaults to today in HKT) so every window — streak, 30d, last7,
 * heatmap — is keyed to the same clock as the rest of the site.
 *
 * Per-habit `tracked` set: a day counts as tracked for a habit when that
 * habit's key EXISTS in the day's habits object — value may be false/0 (a
 * consciously skipped day is still tracked). pct denominators use tracked, not
 * "any habit logged".
 */
export function buildHabitStats(
  habits: HabitEntry[],
  days: DayEntry[],
  todayIso: string = todayHkt(),
): HabitStat[] {
  const doneByHabit = new Map<string, Set<string>>()
  const trackedByHabit = new Map<string, Set<string>>()
  for (const h of habits) {
    doneByHabit.set(h.id, new Set())
    trackedByHabit.set(h.id, new Set())
  }
  for (const d of days) {
    if (!d.data.habits) continue
    for (const [slug, val] of Object.entries(d.data.habits)) {
      if (trackedByHabit.has(slug)) trackedByHabit.get(slug)!.add(d.data.date)
      if (val && doneByHabit.has(slug)) doneByHabit.get(slug)!.add(d.data.date)
    }
  }

  const heatStart = addDaysIso(todayIso, -364)

  return habits.map((h) => {
    const doneSet = doneByHabit.get(h.id)!
    const tracked = trackedByHabit.get(h.id)!

    // Streak walk — consecutive done days ending at `todayIso`.
    let cursor = todayIso
    let currentStreak = 0
    while (doneSet.has(cursor)) {
      currentStreak++
      cursor = addDaysIso(cursor, -1)
    }

    const allKeys = [...tracked].sort()
    let bestStreak = 0
    let run = 0
    for (const k of allKeys) {
      if (doneSet.has(k)) {
        run++
        bestStreak = Math.max(bestStreak, run)
      } else {
        run = 0
      }
    }

    let done30 = 0
    let tracked30 = 0
    for (let i = 29; i >= 0; i--) {
      const k = addDaysIso(todayIso, -i)
      if (tracked.has(k)) {
        tracked30++
        if (doneSet.has(k)) done30++
      }
    }

    const last7: (boolean | null)[] = []
    for (let i = 6; i >= 0; i--) {
      const k = addDaysIso(todayIso, -i)
      last7.push(tracked.has(k) ? doneSet.has(k) : null)
    }

    const heatmap: { date: string; value: boolean | null }[] = []
    for (let i = 0; i < 365; i++) {
      const k = addDaysIso(heatStart, i)
      heatmap.push({ date: k, value: tracked.has(k) ? doneSet.has(k) : null })
    }

    return {
      id: h.id,
      name: h.data.name,
      emoji: h.data.emoji,
      color: h.data.color,
      description: h.data.description,
      done: doneSet.size,
      logged: tracked.size,
      pctAll: tracked.size ? (doneSet.size / tracked.size) * 100 : null,
      pct30: tracked30 ? (done30 / tracked30) * 100 : null,
      currentStreak,
      bestStreak,
      doneToday: tracked.has(todayIso) ? doneSet.has(todayIso) : null,
      last7,
      heatmap,
    }
  })
}

export function todayKey(): string {
  return todayHkt()
}

import type { HabitEntry, HabitLogEntry } from './stats'

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

function dayKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

export function buildHabitStats(habits: HabitEntry[], logs: HabitLogEntry[]): HabitStat[] {
  const byHabit = new Map<string, Set<string>>()
  for (const h of habits) byHabit.set(h.id, new Set())
  const logDates = new Map<string, HabitLogEntry['data']>()
  for (const log of logs) logDates.set(log.data.date, log.data)

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  for (const log of logs) {
    for (const [slug, val] of Object.entries(log.data.values)) {
      if (val && byHabit.has(slug)) byHabit.get(slug)!.add(log.data.date)
    }
  }

  const heatStart = addDays(today, -364)

  return habits.map((h) => {
    const doneDays = [...byHabit.get(h.id)!]
    const doneSet = byHabit.get(h.id)!

    // current streak: walk backwards from today (or yesterday if today not yet logged)
    let cursor = new Date(today)
    if (!logDates.has(dayKey(cursor))) cursor = addDays(cursor, -1)
    let currentStreak = 0
    while (doneSet.has(dayKey(cursor))) {
      currentStreak++
      cursor = addDays(cursor, -1)
    }

    // best streak
    const allKeys = [...logDates.keys()].sort()
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

    // last 30 days pct
    let done30 = 0
    let logged30 = 0
    for (let i = 29; i >= 0; i--) {
      const k = dayKey(addDays(today, -i))
      if (logDates.has(k)) {
        logged30++
        if (doneSet.has(k)) done30++
      }
    }

    // last 7
    const last7: (boolean | null)[] = []
    for (let i = 6; i >= 0; i--) {
      const k = dayKey(addDays(today, -i))
      last7.push(logDates.has(k) ? doneSet.has(k) : null)
    }

    // heatmap year (52 weeks x 7 days)
    const heatmap: { date: string; value: boolean | null }[] = []
    for (let i = 0; i < 365; i++) {
      const d = addDays(heatStart, i)
      const k = dayKey(d)
      heatmap.push({ date: k, value: logDates.has(k) ? doneSet.has(k) : null })
    }

    const logged = logDates.size
    const done = doneDays.length
    return {
      id: h.id,
      name: h.data.name,
      emoji: h.data.emoji,
      color: h.data.color,
      description: h.data.description,
      done,
      logged,
      pctAll: logged ? (done / logged) * 100 : null,
      pct30: logged30 ? (done30 / logged30) * 100 : null,
      currentStreak,
      bestStreak,
      doneToday: logDates.has(dayKey(today)) ? doneSet.has(dayKey(today)) : null,
      last7,
      heatmap,
    }
  })
}

export function todayKey(): string {
  return dayKey(new Date())
}

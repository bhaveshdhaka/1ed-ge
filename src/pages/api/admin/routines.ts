import type { APIRoute } from 'astro'
import { requireSession, json, error } from '../../../lib/auth'
import { todayHkt } from '../../../lib/sessions'
import type { RoutineActivity } from '../../../lib/routine-schema'
import { listMds, readEntry, writeEntry } from '../../../lib/content'
import fs from 'node:fs'
import path from 'node:path'
import { CONTENT } from '../../../lib/paths'

export const prerender = false

/**
 * Unified routines API — replaces the generic MAP-based /api/admin/private/[feature].
 * GET  /api/admin/routines?date=YYYY-MM-DD → all routines for that HKT day (+ day-spine habits)
 * GET  /api/admin/routines?activity=quiet  → all records for that activity
 * POST /api/admin/routines → save a routine completion { activity, minutes?, mood?, practice? }
 *
 * When quiet completes, the day record's habits.quiet-time is also set true (single spine).
 */

const VALID_ACTIVITIES = new Set<RoutineActivity>(['quiet', 'nature', 'exercise', 'intentions', 'rewiring', '21days'])

const ROUTINES_DIR = path.join(CONTENT, 'private', 'routines')

function ensureDir() {
  fs.mkdirSync(ROUTINES_DIR, { recursive: true })
}

function dateFile(date: string, activity: string): string {
  return `${date}-${activity}.md`
}

interface RoutineRecord {
  file: string
  date: string
  activity: string
  completedAt: string
  minutes?: number
  mood?: string
  practice?: string
}

function readRoutineFile(filePath: string): RoutineRecord | null {
  try {
    const raw = fs.readFileSync(filePath, 'utf8')
    const match = raw.match(/^---\n([\s\S]*?)\n---/)
    if (!match) return null
    const data: Record<string, string> = {}
    for (const line of match[1].split('\n')) {
      const idx = line.indexOf(':')
      if (idx < 0) continue
      const key = line.slice(0, idx).trim()
      let val = line.slice(idx + 1).trim()
      if ((val.startsWith("'") && val.endsWith("'")) || (val.startsWith('"') && val.endsWith('"'))) {
        val = val.slice(1, -1)
      }
      data[key] = val
    }
    const file = path.basename(filePath)
    return {
      file,
      date: data.date ?? '',
      activity: data.activity ?? '',
      completedAt: data.completedAt ?? '',
      minutes: data.minutes ? Number(data.minutes) : undefined,
      mood: data.mood || undefined,
      practice: data.practice || undefined,
    }
  } catch {
    return null
  }
}

function writeRoutineFile(date: string, activity: string, data: Record<string, unknown>) {
  ensureDir()
  const file = dateFile(date, activity)
  const filePath = path.join(ROUTINES_DIR, file)
  const lines = ['---']
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined || v === null) continue
    if (typeof v === 'string') {
      lines.push(`${k}: '${v}'`)
    } else {
      lines.push(`${k}: ${v}`)
    }
  }
  lines.push('---')
  lines.push('')
  fs.writeFileSync(filePath, lines.join('\n'))
  return file
}

/** Read the day record's habits for a date (synced from the day spine). */
function dayHabits(date: string): Record<string, unknown> | null {
  try {
    const files = listMds('days')
    const file = files.find((f) => f.replace(/\.md$/, '') === date || f === `${date}.md`)
    if (!file) return null
    const entry = readEntry('days', file)
    return (entry.data.habits as Record<string, unknown>) ?? null
  } catch {
    return null
  }
}

/** Sync quiet-time completion to the day record's habits. */
function syncQuietToDay(date: string, minutes: number) {
  try {
    const files = listMds('days')
    const file = files.find((f) => f.replace(/\.md$/, '') === date || f === `${date}.md`)
    if (!file) return // no day record — that's OK, the routine is still saved
    const entry = readEntry('days', file)
    const habits = { ...((entry.data.habits as Record<string, unknown>) ?? {}) }
    habits['quiet-time'] = true
    writeEntry('days', file, { ...entry.data, habits }, entry.content)
  } catch {
    // silent — the routine save itself succeeded
  }
}

export const GET: APIRoute = async ({ request }) => {
  if (requireSession(request)) return error('unauthorized', 401)

  const url = new URL(request.url)
  const date = url.searchParams.get('date')
  const activity = url.searchParams.get('activity') as RoutineActivity | null

  ensureDir()

  const files = fs.readdirSync(ROUTINES_DIR).filter((f) => f.endsWith('.md'))
  let records: RoutineRecord[] = []

  for (const f of files) {
    const rec = readRoutineFile(path.join(ROUTINES_DIR, f))
    if (!rec) continue
    if (date && rec.date !== date) continue
    if (activity && rec.activity !== activity) continue
    records.push(rec)
  }

  records.sort((a, b) => b.completedAt.localeCompare(a.completedAt))

  // Derive quiet-time state from day-spine habits when no explicit routine record exists
  const habits = date ? dayHabits(date) : null
  const quietFromHabit = habits?.['quiet-time'] === true
  const hasQuietRoutine = records.some((r) => r.activity === 'quiet')

  return json({
    ok: true,
    records,
    today: todayHkt(),
    derived: {
      quietDone: hasQuietRoutine || quietFromHabit,
    },
  })
}

export const POST: APIRoute = async ({ request }) => {
  if (requireSession(request)) return error('unauthorized', 401)

  try {
    const body = await request.json()
    const activity = body.activity as RoutineActivity
    if (!VALID_ACTIVITIES.has(activity)) return error('invalid activity', 400)

    const date = body.date ?? todayHkt()
    const completedAt = body.completedAt ?? new Date().toISOString()
    const data: Record<string, unknown> = {
      date,
      completedAt,
      activity,
    }
    if (body.minutes != null) data.minutes = Number(body.minutes)
    if (body.mood) data.mood = String(body.mood)
    if (body.practice) data.practice = String(body.practice)

    const file = writeRoutineFile(date, activity, data)

    // Sync quiet-time to the day spine (single tracker)
    if (activity === 'quiet' && body.minutes != null) {
      syncQuietToDay(date, Number(body.minutes))
    }

    return json({ ok: true, file })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'failed to save'
    return error(msg, 500)
  }
}

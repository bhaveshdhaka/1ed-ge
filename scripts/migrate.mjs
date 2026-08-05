import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const CONTENT = path.join(ROOT, 'src/content')

const legacy = {
  trades: path.join(CONTENT, 'trades'),
  habitLog: path.join(CONTENT, 'habit-log'),
}

const readMds = (dir) => {
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
      const m = matter(fs.readFileSync(path.join(dir, f), 'utf8'))
      return { file: f, data: m.data, body: m.content }
    })
}

const dayFile = (date) => path.join(CONTENT, 'days', `${date}.md`)
const loadDay = (date) => {
  const f = dayFile(date)
  if (!fs.existsSync(f)) return { date, habits: {}, trades: [] }
  const m = matter(fs.readFileSync(f, 'utf8'))
  return { date, ...(m.data ?? {}), habits: m.data?.habits ?? {}, trades: m.data?.trades ?? [] }
}
const saveDay = (d) => {
  fs.mkdirSync(path.dirname(dayFile(d.date)), { recursive: true })
  fs.writeFileSync(dayFile(d.date), matter.stringify('', d))
}

const trades = readMds(legacy.trades)
const logs = readMds(legacy.habitLog)
let merged = 0

if (trades.length) {
  const byDate = new Map()
  for (const t of trades) {
    const date = String(t.data.date ?? '')
    if (!byDate.has(date)) byDate.set(date, [])
    byDate.get(date).push({
      market: t.data.market ?? 'MNQ',
      session: t.data.session,
      direction: t.data.direction ?? 'long',
      setup: t.data.setup,
      entry: t.data.entry,
      stop: t.data.stop,
      target: t.data.target,
      exit: t.data.exit,
      riskPoints: t.data.riskPoints,
      points: t.data.points,
      confidence: t.data.confidence,
      note: t.data.note,
      screenshots: t.data.screenshots ?? [],
      executions: t.data.account ? [{ account: t.data.account, size: 1 }] : [],
    })
  }
  for (const [date, list] of byDate) {
    const d = loadDay(date)
    d.trades = [...(d.trades ?? []), ...list]
    saveDay(d)
    merged += list.length
  }
}

for (const l of logs) {
  const date = String(l.data.date ?? l.file.replace(/\.md$/, ''))
  const d = loadDay(date)
  d.habits = { ...(d.habits ?? {}), ...(l.data.values ?? {}) }
  if (l.data.note && !d.device) d.device = { notes: l.data.note }
  saveDay(d)
  merged++
}

if (merged) {
  for (const [name, dir] of Object.entries(legacy)) {
    if (fs.existsSync(dir) && fs.readdirSync(dir).some((f) => f.endsWith('.md'))) {
      const archive = path.join(ROOT, '.legacy', name)
      fs.mkdirSync(archive, { recursive: true })
      fs.renameSync(dir, archive)
      console.log(`archived legacy/${name} -> .legacy/${name}`)
    }
  }
  console.log(`migrated ${merged} legacy records into days/`)
} else {
  for (const dir of Object.values(legacy)) {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  }
  console.log('no legacy data — removed empty legacy dirs')
}

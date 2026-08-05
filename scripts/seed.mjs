import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const C = (rel) => path.join(ROOT, 'src/content', rel)
const M = (rel) => path.join(ROOT, 'public', rel)

const today = () => new Date().toISOString().slice(0, 10)

const ensureDir = (dir) => {
  fs.mkdirSync(dir, { recursive: true })
  console.log(`dir  ${path.relative(ROOT, dir)}`)
}

const writeIfMissing = (file, content) => {
  if (fs.existsSync(file)) {
    console.log(`skip ${path.relative(ROOT, file)}`)
    return
  }
  fs.writeFileSync(file, content)
  console.log(`seed ${path.relative(ROOT, file)}`)
}

const fm = (lines) => ['---', ...lines.filter(Boolean), '---', ''].join('\n')

const writeAlways = (file, content) => {
  fs.writeFileSync(file, content)
  console.log(`seed ${path.relative(ROOT, file)}`)
}

// --- accounts ----------------------------------------------------------------
const accounts = [
  {
    slug: 'tpt-25k',
    firm: 'TakeProfitTrader',
    size: 25000,
    sizeLabel: '25k',
    drawdownLimit: 1000,
    trailing: true,
    contract: 'MNQ',
    pointsValue: 2,
    riskPerTrade: 200,
    status: 'active',
    started: today(),
  },
  {
    slug: 'tpt-50k',
    firm: 'TakeProfitTrader',
    size: 50000,
    sizeLabel: '50k',
    drawdownLimit: 2000,
    trailing: true,
    contract: 'MNQ',
    pointsValue: 2,
    riskPerTrade: 200,
    status: 'active',
    started: today(),
  },
  {
    slug: 'lucid-25k',
    firm: 'Lucid',
    size: 25000,
    sizeLabel: '25k',
    drawdownLimit: 1000,
    trailing: true,
    contract: 'MNQ',
    pointsValue: 2,
    riskPerTrade: 200,
    status: 'active',
    started: today(),
  },
  {
    slug: 'lucid-50k',
    firm: 'Lucid',
    size: 50000,
    sizeLabel: '50k',
    drawdownLimit: 2000,
    trailing: true,
    contract: 'MNQ',
    pointsValue: 2,
    riskPerTrade: 200,
    status: 'active',
    started: today(),
  },
]

// --- habits ------------------------------------------------------------------
const habits = [
  { slug: 'quiet-time', name: 'Quiet Time', emoji: '🌫️', color: '#7dd3fc', description: 'Unplugged, no screens, no noise.' },
  { slug: 'trade-clean', name: 'Trade Clean', emoji: '🎯', color: '#4ade80', description: 'Took only my A+ setups, no revenge.' },
  { slug: 'eat-clean', name: 'Eat Clean', emoji: '🥗', color: '#a3e635', description: 'Ate well. No junk.' },
  { slug: 'write', name: 'Write', emoji: '✍️', color: '#fbbf24', description: 'Journaled or wrote something real.' },
  { slug: 'work-out', name: 'Work Out', emoji: '🏋️', color: '#f87171', description: 'Moved the body.' },
  { slug: 'create-art', name: 'Create Art', emoji: '🎨', color: '#c4b5fd', description: 'Made something, however small.' },
]

const day0 = `# Day Zero

this is the beginning of a public experiment.

for the next two years everything here is public — every trade, every account,
every win, every loss, every miss. no hiding. no cherry-picking. if i do not
want the world to see it, i should not be doing it.

the only metric that matters here is **R** — the number of points risked vs the
number of points made. everything else is noise.

- **firms:** takeprofittrader, lucid
- **instrument:** mnq
- **accounts:** 25k (\\$1k drawdown) and 50k (\\$2k drawdown), several of each
- **rule:** risk a fixed \\$ amount per trade, let R tell the story

watch me prove it — or watch me fail. either way, it happens in public.
`

// --- write -------------------------------------------------------------------
for (const d of ['accounts', 'trades', 'journal', 'habits', 'habit-log']) {
  ensureDir(C(d))
}
ensureDir(M('media'))

for (const a of accounts) {
  const body = fm([
    `firm: "${a.firm}"`,
    `size: ${a.size}`,
    `sizeLabel: "${a.sizeLabel}"`,
    `drawdownLimit: ${a.drawdownLimit}`,
    `trailing: ${a.trailing}`,
    `contract: "${a.contract}"`,
    `pointsValue: ${a.pointsValue}`,
    `riskPerTrade: ${a.riskPerTrade}`,
    `status: "${a.status}"`,
    `started: "${a.started}"`,
  ])
  writeIfMissing(C(`accounts/${a.slug}.md`), body + '\n')
}

for (const h of habits) {
  const body = fm([
    `name: "${h.name}"`,
    h.emoji ? `emoji: "${h.emoji}"` : null,
    `color: "${h.color}"`,
    h.description ? `description: "${h.description}"` : null,
  ])
  writeIfMissing(C(`habits/${h.slug}.md`), body + '\n')
}

const journalMeta = fm([
  `date: "${today()}"`,
  `day: "Day Zero"`,
  `summary: "a public experiment begins."`,
  'tags: ["intro", "rules"]',
])
writeIfMissing(C(`journal/0000-welcome.mdx`), journalMeta + '\n' + day0 + '\n')

writeAlways(M('media/.gitkeep'), '')
console.log('\nseed complete')

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const C = (rel) => path.join(ROOT, 'src/content', rel)
const out = (rel) => {
  const p = C(rel)
  fs.mkdirSync(path.dirname(p), { recursive: true })
  return p
}

// ---------------------------------------------------------------- PRNG
function mulberry32(a) {
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rand = mulberry32(20260807)
const ri = (a, b) => a + Math.floor(rand() * (b - a + 1))
const rf = (a, b) => a + rand() * (b - a)
const pick = (arr) => arr[Math.floor(rand() * arr.length)]
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const roundQ = (v) => Math.round(v * 4) / 4
const r1 = (v) => Math.round(v * 10) / 10
const fmt = (n) => (n >= 0 ? '+' : '') + r1(n).toFixed(1)

// ---------------------------------------------------------------- US market day (mirror of src/lib/market.ts — keep in sync)
function isoFromDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function addDays(d, n) {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}
function easterSunday(year) {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4), k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month - 1, day)
}
function nthWeekday(year, month, weekday, n) {
  const first = new Date(year, month, 1)
  const diff = (weekday - first.getDay() + 7) % 7
  return addDays(first, diff + (n - 1) * 7)
}
function lastWeekday(year, month, weekday) {
  const last = new Date(year, month + 1, 0)
  const diff = (last.getDay() - weekday + 7) % 7
  return addDays(last, -diff)
}
function observed(d) {
  const dow = d.getDay()
  if (dow === 6) return addDays(d, -1)
  if (dow === 0) return addDays(d, 1)
  return d
}
function holidaysForYear(year) {
  return [
    new Date(year, 0, 1),
    nthWeekday(year, 0, 1, 3),
    nthWeekday(year, 1, 1, 3),
    addDays(easterSunday(year), -2),
    lastWeekday(year, 4, 1),
    new Date(year, 5, 19),
    new Date(year, 6, 4),
    nthWeekday(year, 8, 1, 1),
    nthWeekday(year, 10, 4, 4),
    new Date(year, 11, 25),
  ].map(observed)
}
const earlyCloseRules = [
  (y) => addDays(nthWeekday(y, 10, 4, 4), 1),
  (y) => new Date(y, 11, 24),
  (y) => new Date(y, 11, 31),
]
function usMarketStatus(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  const dow = dt.getDay()
  if (dow === 0 || dow === 6) return 'closed'
  for (const yy of [y - 1, y, y + 1]) for (const h of holidaysForYear(yy)) if (isoFromDate(h) === iso) return 'closed'
  for (const rule of earlyCloseRules) {
    const e = rule(y)
    if (isoFromDate(e) === iso && e.getDay() !== 0 && e.getDay() !== 6) return 'early'
  }
  return 'open'
}

// ---------------------------------------------------------------- dates
const START = new Date('2026-08-05T00:00:00Z')
const DAYS = 730
const dateStr = (d) => d.toISOString().slice(0, 10)
const dates = []
for (let i = 0; i < DAYS; i++) {
  const d = new Date(START)
  d.setUTCDate(START.getUTCDate() + i)
  dates.push(dateStr(d))
}
const dow = (s) => ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][new Date(s + 'T00:00:00Z').getUTCDay()]
const monthKey = (s) => s.slice(0, 7)

// ---------------------------------------------------------------- market sim
const SETUPS = ['ORB', 'opening-drive', 'pullback', 'trend-continuation', 'vwap-reclaim', 'breakdown', 'liquidity-grab']
const SESSIONS = ['ny-am', 'ny-am', 'ny-am', 'ny-pm', 'ny-pm']
const MODEL = {
  ORB: 'orb-drive',
  'opening-drive': 'orb-drive',
  pullback: 'pullback-continuation',
  'trend-continuation': 'pullback-continuation',
  'vwap-reclaim': 'vwap-reclaim',
  breakdown: 'liquidity-breakdown',
  'liquidity-grab': 'liquidity-breakdown',
}
let basePrice = 20650
let regime = 0
let form = 0

function nextBasePrice() {
  regime = clamp(regime * 0.94 + rf(-0.14, 0.14), -1, 1)
  basePrice = clamp(basePrice + rf(-38, 40) + regime * 22, 19400, 22800)
}

const winMultipliers = [0.75, 1, 1, 1.25, 1.5, 1.5, 1.75, 2]

function genTrade() {
  const direction = rand() < 0.5 + regime * 0.25 ? 'long' : 'short'
  const setup = pick(SETUPS)
  const session = pick(SESSIONS)
  const riskPoints = roundQ(rf(4, 12))
  const win = rand() < 0.56 + clamp(form, -0.12, 0.12) * 0.2
  let R
  if (win) {
    R = pick(winMultipliers)
    if (rand() < 0.05) R = rf(2.5, 4)
  } else {
    R = -r1(rf(1, 1.18))
    if (rand() < 0.02) R = -r1(rf(1.4, 2))
  }
  const entry = roundQ(basePrice + rf(-70, 70))
  const points = roundQ(riskPoints * R)
  const stop = direction === 'long' ? roundQ(entry - riskPoints) : roundQ(entry + riskPoints)
  const exit = direction === 'long' ? roundQ(entry + points) : roundQ(entry - points)
  return {
    market: 'MNQ',
    session,
    direction,
    setup,
    model: MODEL[setup] ?? 'orb-drive',
    entry,
    stop,
    exit,
    riskPoints,
    points,
    confidence: win ? ri(3, 5) : ri(1, 3),
    note: pick(NOTES),
  }
}

const NOTES = [
  'clean execution, let it breathe',
  'waited for the retest, then full size',
  'cut it early — no reason to be in',
  'entered on the displacement, held through the pullback',
  'stopped at the open — that level meant nothing',
  'second attempt only, first one was noise',
  'booked half at 1R, runner to the close',
  'chase — knew better while I was doing it',
  'scaled in on the confirmation candle',
  'the stop was too tight for the ATR of the day',
  'followed my pre-market plan to the point',
  'took the L, re-entered clean, recovered it',
  'late to the move, smaller size than the plan',
  'clean sweep of the lows, then the reversal',
  'held through the lunch chop, out on the move',
]

const PRE_NOTES = [
  'news at 8:30 — flat 15 before, no exceptions.',
  'range is tight, waiting for the drive to pick a side.',
  'plan: one opening-drive attempt, flat by 11.',
  'slept badly, halving size today.',
  'liquidity sweep is the priority, no fades into it.',
  'keep it boring today. one A setup or none.',
]
const NOTE_MOMENTS = [
  'gave the phone to another room for the session.',
  'skipped the second trade — not taking the bait.',
  'small runner, cut it at the close. fine.',
  'took the stop on the chin and moved on.',
  'no trades worth taking after lunch.',
  'reviewed the tape tonight — one bad entry all week.',
]
const TRADE_COMMENTARY = [
  'held the runner to the close — the plan said let it run.',
  'booked half at 1R, walked the rest.',
  'stop was the right call, took it without argument.',
  'scaled in on the confirmation, kept it small.',
  'second attempt after the sweep — that one was clean.',
]
const QUOTES = [
  'fixed risk, every single time. the size is the rule, not the mood.',
  'a loss is information, not an insult.',
  'the trade i did not take is the one i am proudest of.',
  'flat before news. always.',
  'if i would not publish it, i do not do it.',
  'small size until the process is boring.',
  'log everything, especially the ugly.',
  'one clean execution beats ten scrambles.',
]

// ---------------------------------------------------------------- day records
const HABIT_KEYS = [
  'trade-clean', 'quiet-time', 'work-out', 'eat-clean', 'write', 'create-art',
  'sleep', 'read', 'no-social-morning', 'review-evening', 'no-news-trades',
  'meditate', 'plan-before-open', 'stand-up',
]
const COUNT_HABITS = { 'work-out': 30, sleep: 7, read: 30, meditate: 10, 'stand-up': 6 }

function genHabits(mood, sleepQuality, weekend, isTradeDay) {
  const habits = {}
  for (const h of HABIT_KEYS) {
    const base = 0.62 + (mood >= 4 ? 0.2 : -0.18) + (sleepQuality >= 4 ? 0.1 : 0)
    let p = base
    if (h === 'trade-clean') p = isTradeDay ? 0.55 + (mood >= 4 ? 0.28 : -0.15) : 0.85
    if (h === 'quiet-time') p = weekend ? 0.5 : 0.55 + (mood >= 4 ? 0.2 : -0.15)
    if (h === 'work-out') p = mood >= 4 ? 0.55 : 0.3
    if (h === 'no-news-trades') p = isTradeDay ? 0.75 : 0.9
    if (h === 'plan-before-open') p = isTradeDay ? 0.6 + (mood >= 4 ? 0.2 : -0.1) : 0.2
    const done = rand() < clamp(p, 0.08, 0.95)
    if (COUNT_HABITS[h] !== undefined) {
      habits[h] = done ? Math.max(1, Math.round(COUNT_HABITS[h] * rf(0.75, 1.15))) : 0
    } else {
      habits[h] = done
    }
  }
  return habits
}

function genStream(d, isTradeDay) {
  const stream = []
  if (isTradeDay && rand() < 0.3) {
    stream.push({ at: '08:20', type: 'pre-market', text: pick(PRE_NOTES) })
  }
  if (isTradeDay && d.trades.length && rand() < 0.18) {
    stream.push({ at: '11:15', type: 'trade', tradeIdx: 0, text: pick(TRADE_COMMENTARY) })
  }
  if (d.mood >= 4 && rand() < 0.22) {
    stream.push({ at: '20:30', type: 'note', text: pick(NOTE_MOMENTS) })
  }
  if (rand() < 0.05) {
    stream.push({ at: '21:00', type: 'quote', text: pick(QUOTES) })
  }
  return stream
}

function genDay(s) {
  const d = dow(s)
  const weekend = d === 'sat' || d === 'sun'
  const status = usMarketStatus(s)
  const isTradeDay = !weekend && status !== 'closed'
  nextBasePrice()

  const sleepHours = r1(weekend ? rf(5.5, 9.5) : rf(4.6, 8.6))
  const sleepQuality = clamp(Math.round(sleepHours / 2.2 + rf(-1, 1)), 1, 5)
  const baseMood = clamp(Math.round(sleepHours / 2 - 0.4 + rf(-0.8, 0.8) + clamp(form, -0.6, 0.6)), 1, 5)
  const mood = clamp(baseMood + (weekend ? ri(-1, 1) : 0), 1, 5)
  const goodDay = mood >= 4

  const habits = genHabits(mood, sleepQuality, weekend, isTradeDay)

  const iphoneHours = r1(clamp(rf(1.8, 6.5) - goodDay * 1.1 + (sleepQuality <= 2 ? 1.3 : 0), 1.2, 8))
  const socialHours = r1(clamp(iphoneHours * rf(0.28, 0.5), 0.3, 4.5))
  const macHours = r1(weekend ? rf(1.5, 5) : rf(3.5, 7.5))

  const trades = []
  if (isTradeDay) {
    const roll = rand()
    let n
    if (roll < 0.15) n = 0
    else if (roll < 0.15 + 0.4) n = 1
    else if (roll < 0.15 + 0.7) n = 2
    else if (roll < 0.15 + 0.88) n = 3
    else n = 4
    if (mood === 5 && rand() < 0.2) n++
    if (mood === 1 && rand() < 0.3) n = 0
    for (let i = 0; i < n; i++) trades.push(genTrade())
    const won = trades.filter((t) => t.points > 0).length
    const lost = trades.length - won
    form = clamp(form * 0.82 + (trades.length ? (won - lost) / trades.length - 0.5 : 0) * 0.3 + rf(-0.06, 0.06), -0.9, 0.9)
  } else {
    form = form * 0.9 + rf(-0.03, 0.03)
  }

  const stream = genStream({ mood, trades }, isTradeDay)

  return { date: s, mood, sleep: { hours: sleepHours, quality: sleepQuality }, habits, device: { iphoneHours, socialHours, macHours, notes: pick(DEVICE_NOTES) }, trades, stream }
}

const DEVICE_NOTES = [
  'phone died by noon — best trading day of the week',
  'scrolled too long at 6am, felt it all day',
  'kept the phone in another room during the session',
  'normal screen day, nothing to hide',
  'screen time spiked — the markets were slow, my thumb was not',
  'charged the phone across the room, good session focus',
  'one dumb scroll spiral after the loss. logged it.',
  'morning on mac, afternoon off the grid',
  'used the social blocker for the first time — worked',
  'quiet time done right. everything else followed.',
]

// ---------------------------------------------------------------- accounts
const ACCOUNT_BASE = {
  'lucid-50k-a': { firm: 'Lucid', size: 50000, sizeLabel: '50k', drawdownLimit: 2000, riskPerTrade: 200 },
  'lucid-25k-a': { firm: 'Lucid', size: 25000, sizeLabel: '25k', drawdownLimit: 1000, riskPerTrade: 200 },
  'tpt-50k-a': { firm: 'TakeProfitTrader', size: 50000, sizeLabel: '50k', drawdownLimit: 2000, riskPerTrade: 200 },
  'tpt-25k-a': { firm: 'TakeProfitTrader', size: 25000, sizeLabel: '25k', drawdownLimit: 1000, riskPerTrade: 200 },
}
const ACCOUNTS_EXTRA = {
  'tpt-25k-b': { firm: 'TakeProfitTrader', size: 25000, sizeLabel: '25k', drawdownLimit: 1000, riskPerTrade: 200 },
  'lucid-50k-b': { firm: 'Lucid', size: 50000, sizeLabel: '50k', drawdownLimit: 2000, riskPerTrade: 200 },
}
const ACCOUNT_START = {
  'lucid-50k-a': '2026-08-05',
  'lucid-25k-a': '2026-08-05',
  'tpt-50k-a': '2026-08-05',
  'tpt-25k-a': '2026-08-05',
  'tpt-25k-b': '2026-12-06',
  'lucid-50k-b': '2027-03-01',
}
const DOOM_ACCOUNT = 'tpt-25k-a'
const DOOM_END = '2026-12-05'

function accountsOn(date) {
  const list = ['lucid-50k-a', 'lucid-25k-a', 'tpt-50k-a']
  if (date < '2026-12-06') list.push('tpt-25k-a')
  else list.push('tpt-25k-b')
  if (date >= '2027-03-01') list.push('lucid-50k-b')
  return list
}

/** ONE source of truth for executions + lifecycle + payouts. */
function simulateAccounts(days) {
  const all = { ...ACCOUNT_BASE, ...ACCOUNTS_EXTRA }
  const accs = Object.keys(all)
  const net = {}, peak = {}, stage = {}, stages = {}, failed = {}, paid = {}
  const execByDate = {}
  const payouts = []
  for (const a of accs) {
    net[a] = 0; peak[a] = 0; stage[a] = 'eval'; paid[a] = 0; failed[a] = null
    stages[a] = [{ stage: 'eval', from: ACCOUNT_START[a] }]
  }
  const pnl = (t, size) => t.points * 2 * size

  for (const d of days) {
    execByDate[d.date] = []
    if (!d.trades.length) continue
    const active = accs.filter((a) => d.date >= ACCOUNT_START[a] && !failed[a])
    if (!active.length) continue
    const inDoom = d.date >= ACCOUNT_START[DOOM_ACCOUNT] && d.date <= DOOM_END

    const perTrade = d.trades.map(() => [])
    for (let i = 0; i < d.trades.length; i++) {
      const t = d.trades[i]
      const isLoss = t.points < 0
      let primary, size
      if (inDoom && isLoss && rand() < 0.8) {
        primary = DOOM_ACCOUNT
        size = ri(2, 3)
      } else if (inDoom && !isLoss && rand() < 0.12) {
        primary = DOOM_ACCOUNT
        size = 1
      } else {
        primary = pick(active)
        size = ri(1, 4)
      }
      const exs = [{ account: primary, size }]
      if (rand() < 0.35) {
        const second = pick(active.filter((a) => a !== primary))
        if (second) exs.push({ account: second, size: ri(1, 2) })
      }
      perTrade[i] = exs
      for (const ex of exs) {
        net[ex.account] += pnl(t, ex.size)
        peak[ex.account] = Math.max(peak[ex.account], net[ex.account])
      }
    }
    execByDate[d.date] = perTrade

    for (const a of active) {
      const limit = all[a].drawdownLimit
      if (!failed[a] && net[a] - peak[a] < -limit) {
        failed[a] = d.date
        stages[a].push({ stage: 'failed', from: d.date, to: d.date, note: 'drawdown breach — over-leveraged forced entries' })
        stage[a] = 'failed'
        continue
      }
      if (stage[a] === 'eval' && net[a] >= limit * 0.5) {
        stage[a] = 'funded'
        stages[a].push({ stage: 'funded', from: d.date, note: 'passed eval — half the drawdown limit in profit' })
      } else if (stage[a] === 'funded' && net[a] >= limit) {
        stage[a] = 'buffer'
        stages[a].push({ stage: 'buffer', from: d.date, note: 'buffer built' })
      } else if (stage[a] === 'buffer' && net[a] >= limit * 1.5) {
        stage[a] = 'payout'
        stages[a].push({ stage: 'payout', from: d.date, note: 'payout eligible' })
      }
      if (stage[a] === 'payout' && net[a] - paid[a] >= limit * 1.25) {
        const amount = Math.round(Math.min((net[a] - paid[a] - limit) * 0.25, limit * 0.75) / 100) * 100
        if (amount >= 250) {
          paid[a] += amount
          payouts.push({ date: d.date, account: a, amount, note: 'payout — buffer held' })
        }
      }
    }
  }
  return { net, peak, stage, stages, failed, execByDate, payouts, paid }
}

// ---------------------------------------------------------------- coach
const COACH_TOPICS = [
  ['screen time', 'How do I stop the scroll before the open?'],
  ['risk', 'Should I size up now that I have a buffer?'],
  ['losing streak', 'Six losses in eight trades — what is actually happening?'],
  ['revenge trading', 'I took a revenge trade after the stop. How do I kill this habit?'],
  ['setup quality', 'ORB is my best setup but I keep forcing it. What filter do I add?'],
  ['sleep', 'My worst days all follow bad sleep. Is that a real edge?'],
  ['fear of giving back', 'I made money this month and now I am afraid to trade.'],
  ['consistency', 'Why do I nail it for two weeks then give it all back?'],
  ['journaling', 'What should I actually write after each trade?'],
  ['overconfidence', 'Good month, then I started winging entries. Talk to me.'],
  ['focus', 'Phone in the other room fixed my mornings. Anything else?'],
  ['drawdown', 'I am down 700 on the 50k. Am I done?'],
]
const COACH_REPLY = (topic) =>
  `Here’s what I see in your live data:\n\n1. **${topic}** is showing up in the numbers more than in your head. Tighten one input at a time — risk per trade stays fixed, entries only from your A list, and screen time capped before the open.\n2. **The edge is in the plan, not the P&L.** R tells the story. One clean execution is worth ten scrambles.\n\nQuestion: what’s the single most repeatable action you can take tomorrow that makes this trade run automatically?`

// ---------------------------------------------------------------- journal templates
const TEMPLATES = []
const T = (key, title, summary, tags, body) => TEMPLATES.push({ key, title, summary, tags, body })

T('bigwin', 'the A+ setup', 'one setup, held like the plan said, banked the move.',
  ['wins', 'process', 'or-b'], `The day came down to one setup — {{setup}} {{direction}} on MNQ, entered where I marked it last night, stop where it stopped making sense, and I let the runner go. Booked {{r}}R and then I closed the platform. No trophy hunting.

The discipline part isn't the entry — it's the hour after, when the screen keeps begging you to take a second bite. I didn't. The day was done.

{{streak}}. This is the version of me I've been trying to build for months. Same plan, same rules, same fixed risk. The edge is the patience, not the pattern.`)

T('bigloss', 'the trade I should not have taken', 'full stop on the revenge trade, logged honestly.',
  ['losses', 'discipline', 'revenge-trading'], `Today is the exact miss this journal exists for. One stop hit, and instead of walking away I forced a second trade into a market that had nothing for me. {{r}}R. Stupid and fully avoidable.

The tell was physical — I was still clenched from the first loss when I clicked in. That's the signal to close the platform, not to double down.

{{mood}}/5 mood, {{sleep}} hours sleep. Both were already telling me not to trade. I logged it here so it costs me something to ignore next time.`)

T('cleanwin', 'process day', 'unexciting, disciplined, in the black.',
  ['process', 'wins'], `Boring day. One clean {{setup}} in the AM session, {{r}}R, sized the same as every other day this month. Nothing heroic. That's the point — the unremarkable days are the ones that compound.

R is the only number that matters and it's boring to build. Fine by me.`)

T('flat', 'a flat day is not a wasted day', 'no trades worth taking, and that is the win.',
  ['patience', 'no-trade'], `Zero trades today. The market chopped around the levels I wanted to fade and every setup had a catch. I watched most of it, skipped the rest.

The old me would have manufactured a trade to feel busy. The flat day is its own form of profit — it cost nothing, taught me to wait, and tomorrow's capital is still fully intact.`)

T('lowmood', 'honest note: today was heavy', 'the mental side of trading, public.',
  ['mental', 'mood'], `Not a trading post. Just an honest one.

{{sleep}} hours of sleep, {{screen}}h of screen time, mood {{mood}}/5. I stared at charts without seeing them, fought the urge to over-trade, and eventually just closed everything and walked.

This experiment was never only about R. It's about whether a person can hold a process together while life happens. Some days the answer is: barely. I'm writing it down so the graph shows it — the mood line and the screen time are part of the data too.`)

T('screentime', 'the screen time war', 'social hours are the silent tax on focus.',
  ['screen-time', 'habits'], `Deleted the two worst apps off my phone yesterday. Today: {{screen}}h total screen, and my focus during the session was night and day. It's not a willpower thing, it's an environment thing — you can't scroll what isn't installed.

{{r}}R today, which is secondary. The real win was noticing I reached for my phone during a slow stretch and there was nothing to open.`)

T('payout', 'payout day', 'the buffer paid. first of many.',
  ['payout', 'accounts', 'milestone'], `Logged my first payout today — {{account}}, \${{amount}}. It's not a huge number, but it's the first time the process paid cash out of the account instead of just producing a prettier curve.

The rule that got me here is boring: fixed risk per trade, only A setups, log everything. The payout is what happens when you stop treating green days as permission to get greedy.

The account resets its buffer math now. Back to work.`)

T('failed', 'the 25k is gone. here is what killed it', 'full honest post-mortem of the failed account.',
  ['accounts', 'failure', 'post-mortem'], `{{account}} is failed. Drawdown breached, instance closed, and I'm not going to spin it.

What killed it wasn't one bad day — it was a week of 'just one more' trades after a drawdown started. Three of the last five losses were entries I never would have taken at the start of the run. The plan didn't fail; I stopped following it when it was uncomfortable.

New instance is live ({{newAccount}}). Same rules, and this time the drawdown rule is written in the frontmatter so the data holds me to it.`)

T('drawdown', 'the bad stretch', 'a real drawdown, logged while it is happening.',
  ['drawdown', 'mental'], `Eight sessions, mostly red. The curve is doing exactly what curves do when you push a losing streak — it's finding the bottom of my patience.

The honest check: am I still taking my A setups at the same size? Yes. Am I still sleeping, eating, logging? Mostly. Then the process is intact and this is just the drawdown the plan always priced in.

The plan doesn't work only when it's comfortable. That's the whole point of writing it down.`)

T('coach', 'f-R-iend called it', 'the coach saw it in the data before I did.',
  ['coach', 'trends'], `Asked f-R-iend to read the last two weeks of data and it went straight at the thing I was avoiding: my screen time is up 40% and my win rate on PM sessions is the worst it's been. The correlation was sitting in the data the whole time.

Implemented its suggestion — hard social cap before the open, no platform after 4pm. {{r}}R today on a single clean trade. Small sample, but the direction finally matches the intent.`)

T('monthreview', 'month in review', 'the monthly numbers, straight from the dashboard.',
  ['review', 'stats'], `Month's end. Pulled the dashboard and this is what actually happened:

{{monthR}}R for the month, and the R-histogram is finally bell-shaped instead of a shrug. Two payout-level weeks, one revenge-trade week I'm embarrassed by, and a flat stretch where I did nothing dumb.

The lesson that keeps showing up: the month is decided by about four decisions. Protect those four and the rest is noise.`)

T('regime', 'the market changed. i did not', 'chop week vs trend week and the setups that survived.',
  ['market', 'adaptation'], `Last month the trend days paid the bills. This week is chop and my ORB entries are getting chewed. Same setup, wrong regime — the win rate cliff is right there in the data.

Adapted: halved size, moved to liquidity-grab fades at the edges, and only traded the first 90 minutes. It's less exciting and it's keeping me flat instead of bleeding. The market tells you when to slow down. You just have to listen before it makes you.`)

T('overtrade', 'from five trades to two', 'why fewer trades made me more money.',
  ['discipline', 'process'], `I used to think volume was effort. Five trades a day, always in something, always explaining myself in the journal afterward.

Cut to a max of two A setups a day. Same risk per trade. The quality of my entries went up, my losses got smaller, and {{monthR}}R last month beat any month I was 'busy'.

The journal has the receipts. Fewer, better, logged.`)

T('closecall', 'the close call', 'I almost revenge traded. I walked instead.',
  ['discipline', 'mental'], `Stopped out on a sloppy entry, and my hand literally started reaching for the next setup before my brain caught up. Recognized the exact feeling — clenched jaw, fast mouse, zero plan — and closed the laptop instead.

Logged the near-miss because near-misses are how the habit stays alive if you don't look at them. The bad version of today ends with a -2R revenge trade. The real version ends with a long walk and a clear head.`)

T('sleep', 'the sleep experiment', 'seven hours for seven days. results are in.',
  ['sleep', 'habits', 'data'], `One week of forcing 7+ hours of sleep, whatever it took. The data made it undeniable:

Win rate on 6+ hour nights: comfortably above my average. Sub-5 hour nights: my losses cluster there, and so does my screen time. Sleep isn't a soft variable — it's the input everything else hangs off.

I'm treating sleep like part of the trading plan now, not a lifestyle extra.`)

T('doubt', 'am i even good at this?', 'the honest doubt post, because the curve is not a personality.',
  ['mental', 'doubt'], `Real talk: I had a week where I questioned whether I have any edge at all. The R curve, on a bad week, looks like evidence against me.

Then I did the boring thing and checked the actual numbers — win rate, avg win R vs avg loss R, expectancy. The edge is thin and real, not thick and imagined. It only works if I keep taking the same risk and let the sample size do its job.

Doubt is data too. It's the signal to re-check the plan, not to abandon it.`)

T('weekend', 'weekend reflection', 'off the clock, thinking about the week.',
  ['reflection', 'mental'], `No trades this weekend, and the journal still gets an entry — the habit is the point, not the market.

The week: two clean wins, one forced loss, one near-miss I'm still thinking about. The pattern across all of it is the same one — the bad trade came on the day I skipped quiet time and slept badly.

Next week I'm testing one change at a time. Same setup list, same size, sleep non-negotiable.`)

T('book', 'notes on patience', 'what I am trying to get better at, in public.',
  ['process', 'mindset'], `Patience is not a feeling, it's a filter. I'm working on one rule this month: no entry unless the setup was written in the journal before the session.

It cuts my trade count in half and raises the average quality. The setup is the plan; the entry is just where the plan gets executed. When I wait for the exact one, the R takes care of itself.`)

T('smallwin', 'small, real, logged', 'a quiet green day, filed honestly.',
  ['wins', 'process'], `One trade, {{r}}R, logged before I closed the platform. It wasn't the biggest day of the month and it doesn't need to be. The streak that matters is the process streak, and today it's still alive.`)

T('smallloss', 'took the stop', 'a normal, boring loss, handled correctly.',
  ['losses', 'process'], `Stop hit, took it, moved on. {{r}}R, no second trade, no spiral. This is the loss the plan is designed for — small, defined, and forgotten by the time I write this.

The mark of the process isn't avoiding losses. It's the shape of them.`)

T('fatigue', 'tired and still showing up', 'some days the win is just showing up and logging.',
  ['mental', 'habits'], `Long week. Sleep is down, mood is a {{mood}}/5, and the honest version of tonight is that I don't want to write anything. So I'm writing the short version.

The experiment's real test isn't the green days. It's whether I still log the tired, grey days. Today: logged. That counts for something.`)

T('edge', 'the edge is the boring part', 'R, expectancy, and why the mundane wins.',
  ['process', 'edge'], `The whole experiment is on one number: R. Points risked vs points made. Not per-trade P&L, not feelings, not the size of the green days.

A thin edge, taken at fixed risk, hundreds of times, is the whole game. The exciting part of trading is the part that loses people money. The boring part — same size, same setups, log every miss — is the edge.`)

T('traderow', 'read the trends, then fix the input', 'what the correlation table actually said.',
  ['trends', 'data'], `Spent an hour on the performance page reading the correlation table. The headline: my screen time and my losses are linked tighter than I wanted, and my best months all correlate with quiet time streaks.

That's not mystical — it's the input/output table of my own behaviour. When the input is clean, the output is clean. I'm changing one input at a time and watching the correlations move.`)

T('greenstreak', 'the green streak', 'a run of green, held like a pro.',
  ['wins', 'streak'], `A run of green sessions. The dangerous part is now — this is exactly where I've blown it before, by treating a streak as a license to gamble.

Staying at the same size, same setups. The streak is a reward for the process, not a reason to abandon it.`)

T('liquidity', 'playing the liquidity game', 'the fades that paid this week.',
  ['setup', 'market'], `Switched most of my week to liquidity-grab fades — the wicks into old highs that immediately reverse. The data this week: smaller wins, higher win rate, far fewer angry losses.

It's not the most exciting setup but it matches my temperament. The journal shows the style that fits: entries that are mechanical, stops that are obvious, exits that are planned.`)

T('firsttrade', 'trade one, logged', 'the first logged trade of the account.',
  ['milestone'], `First trade logged on {{account}}. Small, clean, {{r}}R, and the whole account lifecycle starts here on the page.

Every account is a story that gets told in frontmatter — stages, payouts, and the day it ends. This one begins today.`)

T('dayzero', 'Day Zero', 'this is the beginning of a public experiment.',
  ['intro', 'rules'], `This is the beginning of a public experiment.

For the next two years everything here is public — every trade, every account, every mood, every miss. No hiding. No cherry-picking. If I wouldn't show it, I shouldn't be doing it.

The only metric that matters here is **R** — the number of points risked vs the number of points made. Everything else is noise.

- **firms:** takeprofittrader, lucid
- **instrument:** mnq
- **accounts:** 25k (\\$1k drawdown) and 50k (\\$2k drawdown), lifecycle tracked from eval → funded → buffer → payout
- **rule:** risk a fixed \\$ amount per trade, let R tell the story

Watch me prove it — or watch me fail. Either way, it happens in public.`)

// short posts
T('short-quickloss', 'quick L', 'one line for the one that stung.', ['losses'], `{{r}}R today. Bad entry, worse timing, logged it and closed the platform. Tomorrow is a fresh sample.`)
T('short-quickwin', 'quick W', 'quick and clean.', ['wins'], `{{r}}R, one trade, done before lunch. The less I do on green days, the more they're worth.`)
T('short-rest', 'rest day', 'took the day off.', ['rest', 'habits'], `No trades. Full day off, phone away, sleep early. The market will still be there tomorrow, and so will I, sharper.`)
T('short-screen', 'screen note', 'the counter keeps dropping.', ['screen-time'], `Social hours today: {{screen}}h. Down from a month ago. The phone stays in the other room during the session — that one change is carrying the week.`)
T('short-sleep', 'sleep check', 'the trend holds.', ['sleep'], `{{sleep}} hours last night. Sub-6 nights are where my losses live; the performance page keeps reminding me.`)
T('short-mindset', 'one rule', 'the reminder post.', ['mindset'], `One rule for this week: if the setup isn't in the journal before the session, I don't take it. That's the whole plan.`)
T('short-coach', 'coach check-in', 'brief conversation with f-R-iend.', ['coach'], `Asked f-R-iend about the losing stretch. It pointed at the same thing I already knew — the bad days follow the bad sleep. One fix at a time.`)

// ---------------------------------------------------------------- pick a template per post
function pickTemplate(d, dayNum, rSumByDay) {
  const mood = d.mood
  const hasTrades = d.trades.length > 0
  const pool = []
  if (!hasTrades) {
    pool.push('flat', 'weekend', 'short-rest')
  } else if (d.rSum >= 3) {
    pool.push('bigwin', 'traderow')
    if (rSumByDay[dayNum - 6] && rSumByDay[dayNum - 6].allGreen) pool.push('greenstreak')
  } else if (d.rSum <= -2) {
    pool.push('bigloss', 'fatigue', 'doubt')
  } else if (d.rSum > 0) {
    pool.push('cleanwin', 'smallwin', 'short-quickwin', 'edge')
  } else {
    pool.push('smallloss', 'short-quickloss', 'closecall', 'overtrade')
  }
  if (mood <= 2) pool.push('lowmood', 'screentime', 'fatigue')
  if (mood >= 4) pool.push('sleep', 'book')
  if (d.sleep && d.sleep.hours < 5.5) pool.push('sleep', 'lowmood')
  return pick(pool)
}

function fillTemplate(t, d, dayNum, monthR, accountInfo) {
  const rSum = d.rSum
  const tradesN = d.trades.length
  const setup = d.trades[0]?.setup ?? 'ORB'
  const direction = d.trades[0]?.direction ?? 'long'
  const streak = dayNum % 7 === 0 ? 'Seven days straight of the process' : 'The process streak is intact'
  const body = t.body
    .replaceAll('{{day}}', String(dayNum))
    .replaceAll('{{date}}', d.date)
    .replaceAll('{{r}}', fmt(rSum))
    .replaceAll('{{trades}}', String(tradesN))
    .replaceAll('{{direction}}', direction)
    .replaceAll('{{setup}}', setup)
    .replaceAll('{{mood}}', String(d.mood))
    .replaceAll('{{sleep}}', String(d.sleep.hours))
    .replaceAll('{{screen}}', String(d.device.socialHours))
    .replaceAll('{{streak}}', streak)
    .replaceAll('{{monthR}}', fmt(monthR))
    .replaceAll('{{account}}', accountInfo.current)
    .replaceAll('{{newAccount}}', accountInfo.next)
    .replaceAll('{{amount}}', String(accountInfo.amount))
  return { title: t.title, summary: t.summary, tags: t.tags, body }
}

// ---------------------------------------------------------------- write everything
const days = dates.map((s, i) => genDay(s))

// per-day rSum + rolling-green for gated templates
const rSumByDay = {}
{
  let greenRun = 0
  for (let i = 0; i < days.length; i++) {
    const d = days[i]
    d.rSum = d.trades.reduce((s, t) => s + t.points / t.riskPoints, 0)
    greenRun = d.rSum > 0 ? greenRun + 1 : 0
    rSumByDay[i] = { allGreen: greenRun >= 7 }
  }
}

// month R for templates
const monthRByKey = {}
{
  let key = null
  let acc = 0
  for (const d of days) {
    const k = monthKey(d.date)
    if (k !== key) { key = k; acc = 0 }
    acc += d.rSum
    monthRByKey[k] = acc
  }
}

// single simulation: executions, lifecycle, payouts — one RNG pass, fully consistent
const sim = simulateAccounts(days)

function writeAccounts() {
  const all = { ...ACCOUNT_BASE, ...ACCOUNTS_EXTRA }
  for (const [id, base] of Object.entries(all)) {
    const st = sim.stages[id]
    const current = st[st.length - 1].stage
    const lines = [
      `id: "${id}"`,
      `firm: "${base.firm}"`,
      `size: ${base.size}`,
      `sizeLabel: "${base.sizeLabel}"`,
      `drawdownLimit: ${base.drawdownLimit}`,
      `trailing: true`,
      `contract: "MNQ"`,
      `pointsValue: 2`,
      `riskPerTrade: ${base.riskPerTrade}`,
      `stage: "${current}"`,
      `stages:`,
      ...st.map((s) =>
        `  - stage: "${s.stage}"\n    from: "${s.from}"${s.to ? `\n    to: "${s.to}"` : ''}${s.note ? `\n    note: "${s.note}"` : ''}`),
    ]
    fs.writeFileSync(out(`accounts/${id}.md`), ['---', ...lines, '---', ''].join('\n'))
  }
  for (const f of fs.readdirSync(C('accounts'))) {
    const id = f.replace(/\.md$/, '')
    if (!all[id]) fs.unlinkSync(path.join(C('accounts'), f))
  }
}

function writePayouts() {
  for (const f of fs.readdirSync(C('payouts')).filter((x) => x.endsWith('.md'))) {
    fs.unlinkSync(path.join(C('payouts'), f))
  }
  sim.payouts.forEach((p) => {
    const body = [
      '---',
      `date: "${p.date}"`,
      `account: "${p.account}"`,
      `amount: ${p.amount}`,
      `status: "paid"`,
      `note: "lifecycle payout — buffer held"`,
      '---',
      '',
    ].join('\n')
    fs.writeFileSync(out(`payouts/${p.date}-${p.account}.md`), body)
  })
}

function writeCoach() {
  for (const f of fs.readdirSync(C('coach')).filter((x) => x.endsWith('.md'))) {
    fs.unlinkSync(path.join(C('coach'), f))
  }
  for (let i = 0; i < 24; i++) {
    const idx = Math.floor((i + 0.5) * (DAYS / 24))
    const date = dates[idx]
    const [q, topic] = COACH_TOPICS[i % COACH_TOPICS.length]
    const time = `${String(ri(7, 20)).padStart(2, '0')}:${String(ri(0, 59)).padStart(2, '0')}`
    const body = [
      '---',
      `date: "${date}"`,
      '---',
      '',
      `## ${date} ${time} · me`,
      q,
      '',
      `## ${date} ${time} · coach`,
      COACH_REPLY(topic),
      '',
    ].join('\n')
    fs.writeFileSync(out(`coach/${date}.md`), body)
  }
}

function writeDays() {
  for (const f of fs.readdirSync(C('days')).filter((x) => x.endsWith('.md'))) {
    fs.unlinkSync(path.join(C('days'), f))
  }
  for (const d of days) {
    const perTrade = sim.execByDate[d.date] || []
    const tradeLines = d.trades.map((t, i) => {
      const exs = perTrade[i] || []
      const exLines = exs.length
        ? exs.map((e) => `          - account: ${e.account}\n            size: ${e.size}`).join('\n')
        : ''
      return [
        `    - market: ${t.market}`,
        `      session: ${t.session}`,
        `      direction: ${t.direction}`,
        `      setup: ${t.setup}`,
        `      model: ${t.model}`,
        `      entry: ${t.entry}`,
        `      stop: ${t.stop}`,
        `      exit: ${t.exit}`,
        `      riskPoints: ${t.riskPoints}`,
        `      points: ${t.points}`,
        `      confidence: ${t.confidence}`,
        `      note: "${t.note}"`,
        exs.length ? `      executions:\n${exLines}` : '      executions: []',
      ]
        .filter(Boolean)
        .join('\n')
    })
    const habitLines = Object.entries(d.habits)
      .map(([k, v]) => `  ${k}: ${v}`)
      .join('\n')
    const streamLines = d.stream.length
      ? 'stream:\n' + d.stream.map((m) => `  - at: "${m.at}"\n    type: ${m.type}${m.text ? `\n    text: "${m.text}"` : ''}${m.tradeIdx !== undefined ? `\n    tradeIdx: ${m.tradeIdx}` : ''}`).join('\n')
      : 'stream: []'
    const body = [
      '---',
      `date: "${d.date}"`,
      `mood: ${d.mood}`,
      `sleep: { hours: ${d.sleep.hours}, quality: ${d.sleep.quality} }`,
      'habits:',
      habitLines,
      'device:',
      `  iphoneHours: ${d.device.iphoneHours}`,
      `  socialHours: ${d.device.socialHours}`,
      `  macHours: ${d.device.macHours}`,
      `  notes: "${d.device.notes}"`,
      d.trades.length ? 'trades:' : 'trades: []',
      ...tradeLines,
      streamLines,
      '---',
      '',
    ].join('\n')
    fs.writeFileSync(out(`days/${d.date}.md`), body)
  }
}

function writeJournal() {
  for (const f of fs.readdirSync(C('journal')).filter((x) => x.endsWith('.mdx'))) {
    fs.unlinkSync(path.join(C('journal'), f))
  }
  const byDay = new Map(days.map((d) => [d.date, d]))
  const postDates = new Set()
  while (postDates.size < 150) {
    const i = ri(0, DAYS - 1)
    const d = days[i]
    const interesting = d.trades.length > 0 || d.mood <= 2 || d.mood >= 4 || i % 5 === 0
    if (interesting || rand() < 0.15) postDates.add(d.date)
  }
  for (const m of ['2026-08-05', '2026-11-13', '2027-01-05', '2027-08-05', '2027-12-05', '2028-08-03']) postDates.add(m)

  // payout dates + the failure date always get a post
  const payoutByDate = new Map(sim.payouts.map((p) => [p.date, p]))
  const failedDate = sim.failed[DOOM_ACCOUNT]
  for (const p of sim.payouts) postDates.add(p.date)
  if (failedDate) postDates.add(failedDate)

  const sorted = [...postDates].sort()
  const accountInfo = { current: 'lucid-50k-a', next: 'tpt-25k-b', amount: 0 }
  let i = 0
  for (const date of sorted) {
    i++
    const d = byDay.get(date)
    if (!d) continue
    const payout = payoutByDate.get(date)
    const t = date === '2026-08-05' ? 'dayzero' : failedDate === date ? 'failed' : payout ? 'payout' : pickTemplate(d, i, rSumByDay)
    const tpl = TEMPLATES.find((x) => x.key === t)
    const dayNum = dates.indexOf(date) + 1
    accountInfo.current = payout?.account ?? (failedDate === date ? DOOM_ACCOUNT : accountInfo.current)
    accountInfo.amount = payout?.amount ?? 0
    const filled = fillTemplate(tpl, d, dayNum, monthRByKey[monthKey(date)], { ...accountInfo })
    const dayLabel = dayNum === 1 ? 'Day Zero' : `Day ${dayNum}`
    const body = [
      '---',
      `date: "${date}"`,
      `day: "${dayLabel}"`,
      `summary: "${filled.summary}"`,
      `tags: [${filled.tags.map((x) => `"${x}"`).join(', ')}]`,
      '---',
      '',
      `# ${filled.title}`,
      '',
      filled.body,
      '',
    ].join('\n')
    fs.writeFileSync(out(`journal/${date}.mdx`), body)
  }
}

// ---------------------------------------------------------------- run
console.log('clearing content dirs…')
for (const sub of ['days', 'journal', 'payouts', 'coach', 'accounts']) {
  fs.mkdirSync(C(sub), { recursive: true })
}
writeAccounts()
writePayouts()
writeCoach()
writeDays()
writeJournal()

const allTrades = days.reduce((s, d) => s + d.trades.length, 0)
let sumR = 0
let peakR = 0
let maxDD = 0
let eq = 0
const rs = []
for (const d of days) for (const t of d.trades) {
  rs.push(t.points / t.riskPoints)
  eq += t.points / t.riskPoints
  peakR = Math.max(peakR, eq)
  maxDD = Math.min(maxDD, eq - peakR)
}
sumR = eq
const wins = rs.filter((r) => r > 0).length
const losses = rs.length - wins
const grossW = rs.filter((r) => r > 0).reduce((s, r) => s + r, 0)
const grossL = Math.abs(rs.filter((r) => r < 0).reduce((s, r) => s + r, 0))

// per-account net vs payouts (from the SAME sim executions — must be coherent)
const paidTot = {}
for (const p of sim.payouts) paidTot[p.account] = (paidTot[p.account] || 0) + p.amount
let coherent = true
for (const [a, base] of Object.entries({ ...ACCOUNT_BASE, ...ACCOUNTS_EXTRA })) {
  const netA = sim.net[a] ?? 0
  const paid = paidTot[a] || 0
  if (paid > Math.max(0, netA)) { coherent = false; console.log(`  !! ${a}: payouts $${paid} > gross $${Math.round(netA)}`) }
  console.log(`  account ${a.padEnd(13)} gross $${String(Math.round(netA)).padStart(5)} · paid $${String(paid).padStart(4)} · ${sim.stages[a][sim.stages[a].length - 1].stage}`)
}
if (!coherent) { console.log('  ✗ PAYOUTS EXCEED NET — fix before shipping'); process.exit(1) }

let holidayTrades = 0
for (const d of days) if (d.trades.length && usMarketStatus(d.date) === 'closed') holidayTrades += d.trades.length

console.log(`  stats:       sumR ${sumR.toFixed(1)} · winRate ${((wins / rs.length) * 100).toFixed(1)}% · PF ${(grossW / grossL).toFixed(2)} · maxDD ${maxDD.toFixed(1)}R · expectancy ${(sumR / rs.length).toFixed(3)}R`)
console.log(`  holiday trades: ${holidayTrades} (must be 0)`)
console.log(`  days:        ${days.length} · trades: ${allTrades} · journal: ${fs.readdirSync(C('journal')).length} · coach: ${fs.readdirSync(C('coach')).length} · payouts: ${sim.payouts.length} · accounts: ${fs.readdirSync(C('accounts')).length}`)
console.log(`  payouts total: $${sim.payouts.reduce((s, p) => s + p.amount, 0)}`)
console.log(`  failed account: ${DOOM_ACCOUNT} on ${sim.failed[DOOM_ACCOUNT] ?? 'never'}`)
console.log('done.')

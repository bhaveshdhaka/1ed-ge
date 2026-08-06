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
const rand = mulberry32(20260805)
const ri = (a, b) => a + Math.floor(rand() * (b - a + 1))
const rf = (a, b) => a + rand() * (b - a)
const pick = (arr) => arr[Math.floor(rand() * arr.length)]
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const roundQ = (v) => Math.round(v * 4) / 4 // 0.25 ticks
const r1 = (v) => Math.round(v * 10) / 10
const fmt = (n) => (n >= 0 ? '+' : '') + r1(n).toFixed(1)

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
const yearOf = (s) => s.slice(0, 4)

// ---------------------------------------------------------------- market sim
const SETUPS = ['ORB', 'pullback', 'breakdown', 'trend-continuation', 'liquidity-grab', 'opening-drive', 'vwap-reclaim']
const SESSIONS = ['ny-am', 'ny-am', 'ny-am', 'ny-pm', 'ny-pm']
let basePrice = 20650
let regime = 0 // -1..1 hidden market bias
let form = 0 // trading form, drifts

function nextBasePrice() {
  regime = clamp(regime * 0.94 + rf(-0.14, 0.14), -1, 1)
  basePrice = clamp(basePrice + rf(-38, 40) + regime * 22, 19400, 22800)
}

const winMultipliers = [0.5, 0.75, 1, 1.5, 1.5, 2, 2, 2.5]
const lossMultipliers = [1, 1, 1, 1.5, 1.5, 2, 2.5]

function genTrade(dayNum) {
  const direction = rand() < 0.5 + regime * 0.25 ? 'long' : 'short'
  const setup = pick(SETUPS)
  const session = pick(SESSIONS)
  const riskPoints = roundQ(rf(4, 12))
  const win = rand() < 0.54 + clamp(form, -0.12, 0.12) * 0.2
  let R
  if (win) {
    R = pick(winMultipliers)
    if (rand() < 0.05) R = rf(3, 4.5) // occasional monster
  } else {
    R = -pick(lossMultipliers)
    if (rand() < 0.04) R = -rf(3, 4)
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

// ---------------------------------------------------------------- day records
const HABIT_KEYS = ['quiet-time', 'trade-clean', 'eat-clean', 'write', 'work-out', 'create-art']

function genDay(s) {
  const d = dow(s)
  const weekend = d === 'sat' || d === 'sun'
  nextBasePrice()

  const sleepHours = r1(weekend ? rf(5.5, 9.5) : rf(4.6, 8.6))
  const sleepQuality = clamp(Math.round(sleepHours / 2.2 + rf(-1, 1)), 1, 5)
  const baseMood = clamp(Math.round(sleepHours / 2 - 0.4 + rf(-0.8, 0.8) + clamp(form, -0.6, 0.6)), 1, 5)
  const mood = clamp(baseMood + (weekend ? ri(-1, 1) : 0), 1, 5)
  const goodDay = mood >= 4

  const habits = {}
  for (const h of HABIT_KEYS) {
    let p = 0.62 + (goodDay ? 0.2 : -0.18) + (sleepQuality >= 4 ? 0.1 : 0)
    if (h === 'trade-clean') p = weekend ? 0.85 : 0.5 + (mood >= 4 ? 0.28 : -0.15) + clamp(form, -0.3, 0.3)
    if (h === 'quiet-time') p = weekend ? 0.5 : 0.55 + (goodDay ? 0.2 : -0.15)
    if (h === 'work-out') p = goodDay ? 0.55 : 0.3
    habits[h] = rand() < clamp(p, 0.08, 0.95)
  }

  const iphoneHours = r1(clamp(rf(1.8, 6.5) - goodDay * 1.1 + (sleepQuality <= 2 ? 1.3 : 0), 1.2, 8))
  const socialHours = r1(clamp(iphoneHours * rf(0.28, 0.5), 0.3, 4.5))
  const macHours = r1(weekend ? rf(1.5, 5) : rf(3.5, 7.5))

  const trades = []
  if (!weekend) {
    const roll = rand()
    let n
    if (roll < 0.13) n = 0
    else if (roll < 0.13 + 0.38) n = 1
    else if (roll < 0.13 + 0.72) n = 2
    else if (roll < 0.13 + 0.9) n = 3
    else n = 4
    if (mood === 5 && rand() < 0.2) n++
    if (mood === 1 && rand() < 0.3) n = 0
    for (let i = 0; i < n; i++) trades.push(genTrade(0))
    const won = trades.filter((t) => t.points > 0).length
    const lost = trades.length - won
    form = clamp(form * 0.82 + (trades.length ? (won - lost) / trades.length - 0.5 : 0) * 0.3 + rf(-0.06, 0.06), -0.9, 0.9)
  } else {
    form = form * 0.9 + rf(-0.03, 0.03)
  }

  return { date: s, mood, sleep: { hours: sleepHours, quality: sleepQuality }, habits, device: { iphoneHours, socialHours, macHours, notes: pick(DEVICE_NOTES) }, trades }
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

// which accounts are active on a given date (for executions)
function accountsOn(date) {
  const list = ['lucid-50k-a', 'lucid-25k-a', 'tpt-50k-a']
  if (date < '2026-12-06') list.push('tpt-25k-a')
  else list.push('tpt-25k-b')
  if (date >= '2027-03-01') list.push('lucid-50k-b')
  return list
}

function executionsFor(date) {
  const accs = accountsOn(date)
  const primary = pick(accs)
  const size = ri(1, 2)
  const exs = [{ account: primary, size }]
  if (rand() < 0.35) {
    const second = pick(accs.filter((a) => a !== primary))
    exs.push({ account: second, size: ri(1, 2) })
  }
  return exs
}

// ---------------------------------------------------------------- payouts
const PAYOUTS = [
  { date: '2027-01-05', account: 'lucid-50k-a', amount: 1200, note: 'first payout — 50k clears the buffer target' },
  { date: '2027-06-18', account: 'lucid-50k-a', amount: 1500, note: 'second payout, consistent 8 weeks' },
  { date: '2027-09-30', account: 'lucid-50k-a', amount: 1800, note: 'quarterly style, kept risk tight' },
  { date: '2026-12-10', account: 'tpt-50k-a', amount: 600, note: 'first payout on the 50k' },
  { date: '2027-05-21', account: 'tpt-50k-a', amount: 900, note: 'second payout after buffer rebuild' },
  { date: '2027-03-19', account: 'lucid-25k-a', amount: 500, note: '25k hits first buffer payout' },
  { date: '2027-08-11', account: 'lucid-25k-a', amount: 700, note: '25k payout — consistency over size' },
  { date: '2027-11-02', account: 'tpt-25k-b', amount: 400, note: 'the rebuild pays out' },
]

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
// {{day}} {{date}} {{r}} {{trades}} {{setup}} {{mood}} {{sleep}} {{screen}} {{streak}} {{monthR}} {{account}}
const TEMPLATES = []

const T = (key, title, summary, tags, body) => TEMPLATES.push({ key, title, summary, tags, body })

T('bigwin', 'the A+ setup', 'one trade, held like the plan said, banked the move.',
  ['wins', 'process', 'or-b'], `I only needed one trade today. {{setup}} long on MNQ, entered exactly where I marked it last night, stop where it stopped making sense, and I let the runner go. Booked {{r}}R across {{trades}} executions and then I closed the platform. No trophy hunting.

The discipline part isn't the entry — it's the hour after, when the screen keeps begging you to take a second bite. I didn't. The day was done.

{{streak}}. This is the version of me I've been trying to build for months. Same plan, same rules, same fixed risk. The edge is the patience, not the pattern.`)

T('bigloss', 'the trade I should not have taken', 'full stop on the revenge trade, logged honestly.',
  ['losses', 'discipline', 'revenge-trading'], `Today is the exact miss this journal exists for. One stop hit, and instead of walking away I forced a second trade into a market that had nothing for me. {{r}}R. Stupid and fully avoidable.

The tell was physical — I was still clenched from the first loss when I clicked in. That's the signal to close the platform, not to double down.

{{mood}}/5 mood, {{sleep}} hours sleep. Both were already telling me not to trade. I logged it here so it costs me something to ignore next time.`)

T('cleanwin', 'process day', 'unexciting, disciplined, in the black.',
  ['process', 'wins'], `Boring day. One clean {{setup}} in the AM session, +{{r}}R, sized the same as every other day this month. Nothing heroic. That's the point — the unremarkable days are the ones that compound.

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

New instance is live ({{newAccount}}). Same rules, and this time I've written the drawdown rule in the frontmatter so the data holds me to it.`)

T('drawdown', 'the bad stretch', 'a real drawdown, logged while it is happening.',
  ['drawdown', 'mental'], `Eight sessions, mostly red. The curve is doing exactly what curves do when you push a losing streak — it's finding the bottom of my patience.

The honest check: am I still taking my A setups at the same size? Yes. Am I still sleeping, eating, logging? Mostly. Then the process is intact and this is just the drawdown the plan always priced in.

The plan doesn't work only when it's comfortable. That's the whole point of writing it down.`)

T('milestone', 'day one hundred', 'a hundred days public. the numbers and the truth.',
  ['milestone', 'meta'], `100 days of this public experiment. Let me be honest about what the data says:

{{r}}R cumulative, {{trades}} trades, and a win rate that's still mid-50s. I am profitable on R and I have not been consistent about it. The good months are real, the bad weeks are real, and they're all on the graph.

What changed in me isn't in the numbers yet: I now know my worst trades happen on bad sleep, and my best days are the ones with the fewest clicks. The experiment is working even when the trading isn't pretty.`)

T('coach', 'f-R-iend called it', 'the coach saw it in the trends before I did.',
  ['coach', 'trends'], `Asked f-R-iend to read the last two weeks of data and it went straight at the thing I was avoiding: my screen time is up 40% and my win rate on PM sessions is the worst it's been. The correlation was sitting in the trends page the whole time.

Implemented its suggestion — hard social cap before the open, no platform after 4pm. {{r}}R today on a single clean trade. Small sample, but the direction finally matches the intent.`)

T('monthreview', 'month in review', 'the monthly numbers, straight from the dashboard.',
  ['review', 'stats'], `Month's end. Pulled the dashboard and this is what actually happened:

{{monthR}}R for the month, {{trades}} trades, and the R-histogram is finally bell-shaped instead of a shrug. Two payout-level weeks, one revenge-trade week I'm embarrassed by, and a flat stretch where I did nothing dumb.

The lesson that keeps showing up: the month is decided by about four decisions. Protect those four and the rest is noise.`)

T('regime', 'the market changed. i did not', 'chop week vs trend week and the setups that survived.',
  ['market', 'adaptation'], `Last month the trend days paid the bills. This week is chop and my ORB entries are getting chewed. Same setup, wrong regime — the data on /trends shows the win rate cliff pretty clearly.

Adapted: halved size, moved to liquidity-grab fades at the edges, and only traded the first 90 minutes. It's less exciting and it's keeping me flat instead of bleeding. The market tells you when to slow down. You just have to listen before it makes you.`)

T('overtrade', 'from five trades to two', 'why fewer trades made me more money.',
  ['discipline', 'process'], `I used to think volume was effort. Five trades a day, always in something, always explaining myself in the journal afterward.

Cut to a max of two A setups a day. Same risk per trade. The quality of my entries went up, my losses got smaller, and {{monthR}}R last month beat any month I was 'busy'.

The journal has the receipts. Fewer, better, logged.`)

T('closecall', 'the close call', 'I almost revenge traded. I walked instead.',
  ['discipline', 'mental'], `Stopped out on a sloppy entry, and my hand literally started reaching for the next setup before my brain caught up. Recognized the exact feeling — clenched jaw, fast mouse, zero plan — and closed the laptop instead.

Logged the near-miss because near-misses are how the habit stays alive if you don't look at them. The bad version of today ends with a -2R revenge trade. The real version ends with a long walk and a clear head.`)

T('sleep', 'the sleep experiment', 'seven hours for seven days. results are in.',
  ['sleep', 'habits', 'data'], `One week of forcing 7+ hours of sleep, whatever it took. The trends page made it undeniable:

Win rate on 6+ hour nights: comfortably above my average. Sub-5 hour nights: my losses cluster there, and so does my screen time. Sleep isn't a soft variable — it's the input everything else hangs off.

I'm treating sleep like part of the trading plan now, not a lifestyle extra.`)

T('doubt', 'am i even good at this?', 'the honest doubt post, because the curve is not a personality.',
  ['mental', 'doubt'], `Real talk: I had a week where I questioned whether I have any edge at all. The R curve, on a bad week, looks like evidence against me.

Then I did the boring thing and checked the actual numbers — win rate, avg win R vs avg loss R, expectancy. The edge is thin and real, not thick and imagined. It only works if I keep taking the same risk and let the sample size do its job.

Doubt is data too. It's the signal to re-check the plan, not to abandon it.`)

T('habit30', 'thirty days of quiet time', 'the streak is real and so is the effect.',
  ['habits', 'streak'], `30 consecutive days of quiet time — no screens, no noise, one hour before bed. Longest habit streak on the tracker.

The effect shows up in the data: better sleep quality, lower social screen time, and my best month of R came in that window. One hour of nothing, every night, and it compounds harder than any setup I trade.

The heatmap doesn't lie. A green cell a day is the whole strategy.`)

T('weekend', 'weekend reflection', 'off the clock, thinking about the week.',
  ['reflection', 'mental'], `No trades this weekend, and the journal still gets an entry — the habit is the point, not the market.

The week: two clean wins, one forced loss, one near-miss I'm still thinking about. The pattern across all of it is the same one — the bad trade came on the day I skipped quiet time and slept badly.

Next week I'm testing one change at a time. Same setup list, same size, sleep non-negotiable.`)

T('book', 'notes on patience', 'what I am trying to get better at, in public.',
  ['process', 'mindset'], `Patience is not a feeling, it's a filter. I'm working on one rule this month: no entry unless the setup was written in the journal before the session.

It cuts my trade count in half and raises the average quality. The setup is the plan; the entry is just where the plan gets executed. When I wait for the exact one, the R takes care of itself.`)

T('smallwin', 'small, real, logged', 'a quiet green day, filed honestly.',
  ['wins', 'process'], `One trade, +{{r}}R, logged before I closed the platform. It wasn't the biggest day of the month and it doesn't need to be. The streak that matters is the process streak, and today it's still alive.`)

T('smallloss', 'took the stop', 'a normal, boring loss, handled correctly.',
  ['losses', 'process'], `Stop hit, took it, moved on. {{r}}R, no second trade, no spiral. This is the loss the plan is designed for — small, defined, and forgotten by the time I write this.

The mark of the process isn't avoiding losses. It's the shape of them.`)

T('fatigue', 'tired and still showing up', 'some days the win is just showing up and logging.',
  ['mental', 'habits'], `Long week. Sleep is down, mood is a {{mood}}/5, and the honest version of tonight is that I don't want to write anything. So I'm writing the short version.

The experiment's real test isn't the green days. It's whether I still log the tired, grey days. Today: logged. That counts for something.`)

T('scale', 'when do i size up?', 'the honest answer about position size.',
  ['risk', 'accounts'], `Someone would be right to ask why I'm not sizing up with a payout in the bank. The answer is the drawdown math: one bad week at double size wipes months of careful buffer building.

The data on /accounts shows exactly how the buffer behaves when you respect it. I size up only when the rules say the account earned it — the rules, not my mood.`)

T('edge', 'the edge is the boring part', 'R, expectancy, and why the mundane wins.',
  ['process', 'edge'], `The whole experiment is on one number: R. Points risked vs points made. Not per-trade P&L, not feelings, not the size of the green days.

A thin edge, taken at fixed risk, hundreds of times, is the whole game. The exciting part of trading is the part that loses people money. The boring part — same size, same setups, log every miss — is the edge.`)

T('traderow', 'read the trends, then fix the input', 'what the correlation table actually said.',
  ['trends', 'data'], `Spent an hour on /trends reading the correlation table. The headline: my screen time and my losses are linked tighter than I wanted, and my best months all correlate with quiet time streaks.

That's not mystical — it's the input/output table of my own behaviour. When the input is clean, the output is clean. I'm changing one input at a time and watching the correlations move.`)

T('greenstreak', 'seven green', 'a week of green, held like a pro.',
  ['wins', 'streak'], `Seven green sessions. The dangerous part is now — this is exactly where I've blown it before, by treating a streak as a license to gamble.

Staying at the same size, same setups. The streak is a reward for the process, not a reason to abandon it.`)

T('liquidity', 'playing the liquidity game', 'the fades that paid this week.',
  ['setup', 'market'], `Switched most of my week to liquidity-grab fades — the wicks into old highs that immediately reverse. The data this week: smaller wins, higher win rate, far fewer angry losses.

It's not the most exciting setup but it matches my temperament. The journal shows the style that fits: entries that are mechanical, stops that are obvious, exits that are planned.`)

T('firsttrade', 'trade one, logged', 'the first logged trade of the account.',
  ['milestone'], `First trade logged on {{account}}. Small, clean, +{{r}}R, and the whole account lifecycle starts here on the page.

Every account is a story that gets told in frontmatter — stages, payouts, and the day it ends. This one begins today.`)

T('dayzero', 'Day Zero', 'this is the beginning of a public experiment.',
  ['intro', 'rules'], `This is the beginning of a public experiment.

For the next two years everything here is public — every trade, every account, every mood, every miss. No hiding. No cherry-picking. If I wouldn't show it, I shouldn't be doing it.

The only metric that matters here is **R** — the number of points risked vs the number of points made. Everything else is noise.

- **firms:** takeprofittrader, lucid
- **instrument:** mnq
- **accounts:** 25k (\\$1k drawdown) and 50k (\\$2k drawdown), lifecycle tracked from eval → buffer → payout
- **rule:** risk a fixed \\$ amount per trade, let R tell the story

Watch me prove it — or watch me fail. Either way, it happens in public.`)

// short posts
T('short-quickloss', 'quick L', 'one line for the one that stung.', ['losses'], `{{r}}R today. Bad entry, worse timing, logged it and closed the platform. Tomorrow is a fresh sample.`)
T('short-quickwin', 'quick W', 'quick and clean.', ['wins'], `+{{r}}R, one trade, done before lunch. The less I do on green days, the more they're worth.`)
T('short-rest', 'rest day', 'took the day off.', ['rest', 'habits'], `No trades. Full day off, phone away, sleep early. The market will still be there tomorrow, and so will I, sharper.`)
T('short-screen', 'screen note', 'the counter keeps dropping.', ['screen-time'], `Social hours today: {{screen}}h. Down from a month ago. The phone stays in the other room during the session — that one change is carrying the week.`)
T('short-sleep', 'sleep check', 'the trend holds.', ['sleep'], `{{sleep}} hours last night. Sub-6 nights are where my losses live; the trends page keeps reminding me.`)
T('short-mindset', 'one rule', 'the reminder post.', ['mindset'], `One rule for this week: if the setup isn't in the journal before the session, I don't take it. That's the whole plan.`)
T('short-coach', 'coach check-in', 'brief conversation with f-R-iend.', ['coach'], `Asked f-R-iend about the losing stretch. It pointed at the same thing I already knew — the bad days follow the bad sleep. One fix at a time.`)

// ---------------------------------------------------------------- pick a template per post
function pickTemplate(d, dayNum) {
  const mood = d.mood
  const hasTrades = d.trades.length > 0
  const rSum = d.trades.reduce((s, t) => s + (t.points / t.riskPoints), 0)
  const wins = d.trades.filter((t) => t.points > 0).length
  const pool = []
  if (!hasTrades) {
    pool.push('flat', 'weekend', 'short-rest')
  } else if (rSum >= 3) {
    pool.push('bigwin', 'greenstreak', 'traderow')
  } else if (rSum <= -2) {
    pool.push('bigloss', 'fatigue', 'doubt')
  } else if (rSum > 0) {
    pool.push('cleanwin', 'smallwin', 'short-quickwin', 'edge')
  } else {
    pool.push('smallloss', 'short-quickloss', 'closecall', 'overtrade')
  }
  if (mood <= 2) pool.push('lowmood', 'screentime', 'fatigue')
  if (mood >= 4) pool.push('sleep', 'habit30', 'book')
  if (d.sleep && d.sleep.hours < 5.5) pool.push('sleep', 'lowmood')
  return pick(pool)
}

function fillTemplate(t, d, dayNum, monthR, accountInfo) {
  const rSum = d.trades.reduce((s, t) => s + t.points / t.riskPoints, 0)
  const tradesN = d.trades.length
  const setup = d.trades[0]?.setup ?? 'ORB'
  const streak = dayNum % 7 === 0 ? 'Seven days straight of the process' : 'The process streak is intact'
  const body = t.body
    .replaceAll('{{day}}', String(dayNum))
    .replaceAll('{{date}}', d.date)
    .replaceAll('{{r}}', fmt(rSum))
    .replaceAll('{{trades}}', String(tradesN))
    .replaceAll('{{setup}}', setup)
    .replaceAll('{{mood}}', String(d.mood))
    .replaceAll('{{sleep}}', String(d.sleep.hours))
    .replaceAll('{{screen}}', String(d.device.socialHours))
    .replaceAll('{{streak}}', streak)
    .replaceAll('{{monthR}}', fmt(monthR))
    .replaceAll('{{account}}', accountInfo.current)
    .replaceAll('{{newAccount}}', accountInfo.next)
    .replaceAll('{{amount}}', String(1200))
  const title = t.title
  const summary = t.summary
  return { title, summary, tags: t.tags, body }
}

// ---------------------------------------------------------------- write everything
const days = dates.map((s, i) => genDay(s))

// month R for templates
const monthRByKey = {}
{
  let key = null
  let acc = 0
  for (const d of days) {
    const k = monthKey(d.date)
    if (k !== key) { key = k; acc = 0 }
    acc += d.trades.reduce((s, t) => s + t.points / t.riskPoints, 0)
    monthRByKey[k] = acc
  }
}

// accounts: lifecycle
const ACCOUNT_DEFS = {
  'lucid-50k-a': { stages: [
    { stage: 'eval', from: '2026-08-05' },
    { stage: 'buffer', from: '2026-09-21', note: 'cleared eval in 7 weeks, +48R' },
  ], stage: 'buffer' },
  'lucid-25k-a': { stages: [
    { stage: 'eval', from: '2026-08-05' },
    { stage: 'buffer', from: '2026-11-04', note: 'consistent small size' },
  ], stage: 'buffer' },
  'tpt-50k-a': { stages: [
    { stage: 'eval', from: '2026-08-05' },
    { stage: 'buffer', from: '2026-10-12' },
    { stage: 'payout', from: '2026-12-10', note: 'first payout $600' },
  ], stage: 'payout' },
  'tpt-25k-a': { stages: [
    { stage: 'eval', from: '2026-08-05' },
    { stage: 'failed', from: '2026-12-05', to: '2026-12-05', note: 'drawdown breach — forced entries during a losing week' },
  ], stage: 'failed' },
  'tpt-25k-b': { stages: [
    { stage: 'eval', from: '2026-12-06', note: 'rebuild after 25k-a failure' },
    { stage: 'buffer', from: '2027-04-11' },
  ], stage: 'buffer' },
  'lucid-50k-b': { stages: [
    { stage: 'eval', from: '2027-03-01', note: 'second 50k for scale' },
    { stage: 'buffer', from: '2027-08-02' },
  ], stage: 'buffer' },
}

function writeAccounts() {
  const all = { ...ACCOUNT_BASE, ...ACCOUNTS_EXTRA }
  for (const [id, base] of Object.entries(all)) {
    const def = ACCOUNT_DEFS[id] ?? { stages: [{ stage: 'eval', from: '2026-08-05' }], stage: 'eval' }
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
      `stage: "${def.stage}"`,
      `stages:`,
      ...def.stages.map((st) =>
        `  - stage: "${st.stage}"\n    from: "${st.from}"${st.to ? `\n    to: "${st.to}"` : ''}${st.note ? `\n    note: "${st.note}"` : ''}`),
    ]
    fs.writeFileSync(out(`accounts/${id}.md`), ['---', ...lines, '---', ''].join('\n'))
  }
  // remove any account files not in our set
  for (const f of fs.readdirSync(C('accounts'))) {
    const id = f.replace(/\.md$/, '')
    if (!all[id]) fs.unlinkSync(path.join(C('accounts'), f))
  }
}

function writePayouts() {
  for (const f of fs.readdirSync(C('payouts')).filter((x) => x.endsWith('.md'))) {
    fs.unlinkSync(path.join(C('payouts'), f))
  }
  PAYOUTS.forEach((p, i) => {
    const body = [
      '---',
      `date: "${p.date}"`,
      `account: "${p.account}"`,
      `amount: ${p.amount}`,
      `status: "paid"`,
      p.note ? `note: "${p.note}"` : '',
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
  // 24 conversations spaced across the window
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
    const exs = d.trades.map((t) => {
      const accs = executionsFor(d.date)
      return `      - market: ${t.market}\n        session: ${t.session}\n        direction: ${t.direction}\n        setup: ${t.setup}\n        entry: ${t.entry}\n        stop: ${t.stop}\n        exit: ${t.exit}\n        riskPoints: ${t.riskPoints}\n        points: ${t.points}\n        confidence: ${t.confidence}\n        note: "${t.note}"\n        executions:\n${accs.map((a) => `          - account: ${a.account}\n            size: ${a.size}`).join('\n')}`
    })
    const habitLines = Object.entries(d.habits)
      .map(([k, v]) => `  ${k}: ${v}`)
      .join('\n')
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
      ...exs,
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
  // pick ~150 post dates, weighted to interesting days, over the full window
  const postDates = new Set()
  while (postDates.size < 150) {
    const i = ri(0, DAYS - 1)
    const d = days[i]
    const interesting =
      d.trades.length > 0 ||
      d.mood <= 2 ||
      d.mood >= 4 ||
      i % 5 === 0
    if (interesting || rand() < 0.15) postDates.add(d.date)
  }
  // force a few milestone dates
  for (const m of ['2026-08-05', '2026-11-13', '2027-01-05', '2027-08-05', '2027-12-05', '2028-08-03']) postDates.add(m)

  const sorted = [...postDates].sort()
  const accountInfo = { current: 'lucid-50k-a', next: 'tpt-25k-b' }
  let i = 0
  for (const date of sorted) {
    i++
    const d = byDay.get(date)
    if (!d) continue
    const t = date === '2026-08-05' ? 'dayzero' : pickTemplate(d, i)
    const tpl = TEMPLATES.find((x) => x.key === t)
    const dayNum = dates.indexOf(date) + 1
    const filled = fillTemplate(tpl, d, dayNum, monthRByKey[monthKey(date)], accountInfo)
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
  // remove stale journal files (e.g. old 2026-08-06 test post) handled above by clearing dir
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

const trades = days.reduce((s, d) => s + d.trades.length, 0)
// quick stats sanity check (same R math as src/lib/stats.ts)
let sumR = 0
let peakR = 0
let maxDD = 0
const all = []
for (const d of days) for (const t of d.trades) all.push(t.points / t.riskPoints)
let eq = 0
for (const r of all) { eq += r; peakR = Math.max(peakR, eq); maxDD = Math.min(maxDD, eq - peakR) }
sumR = eq
const wins = all.filter((r) => r > 0).length
const losses = all.length - wins
const grossW = all.filter((r) => r > 0).reduce((s, r) => s + r, 0)
const grossL = Math.abs(all.filter((r) => r < 0).reduce((s, r) => s + r, 0))
console.log(`  stats:       sumR ${sumR.toFixed(1)} · winRate ${((wins / all.length) * 100).toFixed(1)}% · PF ${(grossW / grossL).toFixed(2)} · maxDD ${maxDD.toFixed(1)}R · expectancy ${(sumR / all.length).toFixed(3)}R`)
console.log('done.')
console.log(`  days:        ${days.length}`)
console.log(`  trades:      ${trades}`)
console.log(`  journal:     ${fs.readdirSync(C('journal')).length} posts`)
console.log(`  coach:       ${fs.readdirSync(C('coach')).length} conversations`)
console.log(`  payouts:     ${fs.readdirSync(C('payouts')).length}`)
console.log(`  accounts:    ${fs.readdirSync(C('accounts')).length}`)

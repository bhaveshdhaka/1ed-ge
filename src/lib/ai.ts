import { env } from './env'
import { round2 } from './utils'

interface OrPart {
  type: string
  text?: string
  image_url?: { url: string }
}

interface OrMessage {
  role: 'system' | 'user' | 'assistant'
  content: string | OrPart[]
}

export async function orChat(messages: OrMessage[], model: string, json = true, maxTokens = 2500) {
  const key = env.openrouterKey()
  if (!key) throw new Error('OPENROUTER_API_KEY is not set')
  let res: Response
  try {
    res = await fetch(`${env.openrouterBase()}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
        'HTTP-Referer': env.siteUrl(),
        'X-Title': '1ed.ge',
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.2,
        max_tokens: maxTokens,
        ...(json ? { response_format: { type: 'json_object' } } : {}),
      }),
      signal: AbortSignal.timeout(60_000),
    })
  } catch (e) {
    if (e instanceof Error && e.name === 'TimeoutError') {
      throw new Error('AI request timed out after 60s — try again')
    }
    throw e
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`OpenRouter ${res.status}: ${text.slice(0, 300)}`)
  }
  const data = await res.json()
  const content: string = data?.choices?.[0]?.message?.content ?? ''
  return content
}

function tryJson<T>(raw: string): T | null {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim()
  try {
    return JSON.parse(cleaned) as T
  } catch {
    const start = cleaned.indexOf('{')
    const end = cleaned.lastIndexOf('}')
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1)) as T
      } catch {
        return null
      }
    }
    return null
  }
}

export interface StructuredTrade {
  market: string | null
  session: string | null
  direction: 'long' | 'short' | null
  setup: string | null
  entry: number | null
  stop: number | null
  target: number | null
  exit: number | null
  riskPoints: number | null
  points: number | null
  confidence: number | null
  note: string | null
  accounts: string[] | null
  screenshotIndices: number[] | null
}

export interface StructuredDay {
  mood: number | null
  sleepHours: number | null
  sleepQuality: number | null
  habits: Record<string, boolean> | null
  device: { iphoneHours: number | null; socialHours: number | null; macHours: number | null; notes: string | null } | null
  deviceScreens: number[]
  trades: StructuredTrade[]
  journal: { title: string | null; summary: string | null; tags: string[] | null; draft: string | null } | null
}

const TRADE_SHAPE = `{
  "market": "MNQ",
  "session": "asia|london|ny-am|ny-pm or null",
  "direction": "long|short or null",
  "setup": "short setup name or null",
  "entry": "number or null",
  "stop": "number or null",
  "target": "number or null",
  "exit": "number or null",
  "riskPoints": "number or null",
  "points": "number or null",
  "confidence": "integer 1-5 or null",
  "note": "one-line summary or null",
  "accounts": ["account id(s) from the list, or [] if unknown"],
  "screenshotIndices": [0..n-1 image indices for THIS trade's charts, or []]
}`

export async function structureDayFull(
  raw: string,
  images: string[],
  ctx: { accounts: string[]; habits: string[] },
): Promise<StructuredDay> {
  const system = `You are the structuring engine for 1ed.ge, a trader's public journal. You convert the trader's raw daily notes + screenshots into ONE structured JSON record, reading ALL provided images AND the free text for full context.
Rules:
- Output ONLY valid JSON. No markdown fences, no prose.
- Use null when missing; [] when none.
- direction is "long" or "short". riskPoints = |entry - stop|. points = signed net points (+profit / -loss).
- Each trade = one setup/position (NOT one account). If the same trade ran on multiple accounts, list all account ids in that trade's "accounts".
- habits: object keyed by habit slug -> boolean (true = done that day). Only set values you are confident about; omit the rest. Available habit slugs: ${ctx.habits.join(', ') || 'none'}.
- device: fill iphoneHours / socialHours / macHours from screen-time screenshots or text; notes = one honest line about phone/screen behaviour.
- Images are numbered 0..N-1 in the order given (${images.length} images total). Decide where each belongs:
  - screen-time report -> "deviceScreens": [its index]
  - a trade chart/ticket -> that trade's "screenshotIndices": [its index]
  - other day-level photos -> "deviceScreens"
- accounts must be from: ${ctx.accounts.join(', ') || 'none'}.
- journal: propose an honest reflection for the day, grounded ONLY in what the data/text shows (never invent). "title": short understated title; "summary": 1-2 sentences; "tags": 2-4 lowercase tags; "draft": a first-draft markdown reflection of 2-4 short paragraphs in the trader's voice (plain, raw, no hype) referencing the actual trades, mood, sleep and screen behaviour. If there is nothing worth writing, use nulls / [].
Return exactly this shape:
{
  "mood": 1-5 or null,
  "sleepHours": number or null,
  "sleepQuality": 1-5 or null,
  "habits": { "slug": boolean },
  "device": { "iphoneHours": number or null, "socialHours": number or null, "macHours": number or null, "notes": string or null },
  "deviceScreens": [0..n-1],
  "trades": [ ${TRADE_SHAPE} ],
  "journal": { "title": string or null, "summary": string or null, "tags": [string] or [], "draft": markdown string or null }
}`

  const userText = `Raw day notes:\n\n${raw.slice(0, 12000)}`

  const hasImages = images.length > 0
  const messages: OrMessage[] = [
    { role: 'system', content: system },
    {
      role: 'user',
      content: hasImages
        ? [
            { type: 'text', text: userText },
            ...images.map((url) => ({ type: 'image_url' as const, image_url: { url } })),
          ]
        : userText,
    },
  ]

  const rawJson = await orChat(messages, hasImages ? env.modelVision() : env.modelStructure(), !hasImages, 4500)
  const parsed = tryJson<Partial<StructuredDay>>(rawJson)
  if (!parsed) throw new Error('AI returned unparseable JSON')

  const trades = Array.isArray(parsed.trades) ? parsed.trades : []
  return {
    mood: int(parsed.mood),
    sleepHours: num(parsed.sleepHours),
    sleepQuality: int(parsed.sleepQuality),
    habits: parsed.habits && typeof parsed.habits === 'object' ? (parsed.habits as Record<string, boolean>) : null,
    device: parsed.device && typeof parsed.device === 'object'
      ? {
          iphoneHours: num((parsed.device as any).iphoneHours),
          socialHours: num((parsed.device as any).socialHours),
          macHours: num((parsed.device as any).macHours),
          notes: typeof (parsed.device as any).notes === 'string' ? (parsed.device as any).notes : null,
        }
      : null,
    deviceScreens: Array.isArray(parsed.deviceScreens) ? parsed.deviceScreens.map(Number).filter((n) => Number.isInteger(n) && n >= 0) : [],
    journal:
      parsed.journal && typeof parsed.journal === 'object'
        ? {
            title: typeof (parsed.journal as any).title === 'string' ? (parsed.journal as any).title : null,
            summary: typeof (parsed.journal as any).summary === 'string' ? (parsed.journal as any).summary : null,
            tags: Array.isArray((parsed.journal as any).tags)
              ? (parsed.journal as any).tags.map(String).filter((t: string) => t.trim()).slice(0, 6)
              : [],
            draft: typeof (parsed.journal as any).draft === 'string' ? (parsed.journal as any).draft : null,
          }
        : null,
    trades: trades.map((t) => ({
      market: typeof t?.market === 'string' ? String(t.market).toUpperCase() : 'MNQ',
      session: typeof t?.session === 'string' ? t.session : null,
      direction: t?.direction === 'long' || t?.direction === 'short' ? t.direction : null,
      setup: typeof t?.setup === 'string' ? t.setup : null,
      entry: num(t?.entry),
      stop: num(t?.stop),
      target: num(t?.target),
      exit: num(t?.exit),
      riskPoints: num(t?.riskPoints),
      points: num(t?.points),
      confidence: int(t?.confidence),
      note: typeof t?.note === 'string' ? t.note : null,
      accounts: Array.isArray(t?.accounts) ? t.accounts.map(String).filter((a) => ctx.accounts.includes(a)) : [],
      screenshotIndices: Array.isArray(t?.screenshotIndices)
        ? t.screenshotIndices.map(Number).filter((n) => Number.isInteger(n) && n >= 0)
        : [],
    })),
  }
}

export interface VisionTrade {
  entry: number | null
  exit: number | null
  stop: number | null
  points: number | null
  direction: 'long' | 'short' | null
  session: string | null
  note: string | null
}

export async function readScreenshot(dataUrl: string): Promise<VisionTrade> {
  const system = `You read trading screenshots (charts, trade tickets, execution logs).
Extract:
- entry: fill or entry price
- exit: exit / close price if visible
- stop: stop-loss price if visible
- points: signed net points (+gain / -loss)
- direction: "long" or "short"
- session: "asia", "london", "ny-am", "ny-pm" or null if not inferable
- note: one line describing what the chart/ticket shows
Output ONLY valid JSON with keys: entry, exit, stop, points, direction, session, note. Use null when unknown.`

  const rawJson = await orChat(
    [
      { role: 'system', content: system },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Read this trade screenshot:' },
          { type: 'image_url', image_url: { url: dataUrl } },
        ],
      },
    ],
    env.modelVision(),
    true,
    1000,
  )
  const parsed = tryJson<Partial<VisionTrade>>(rawJson) ?? {}
  return {
    entry: num(parsed.entry),
    exit: num(parsed.exit),
    stop: num(parsed.stop),
    points: num(parsed.points),
    direction: parsed.direction === 'long' || parsed.direction === 'short' ? parsed.direction : null,
    session: typeof parsed.session === 'string' ? parsed.session : null,
    note: typeof parsed.note === 'string' ? parsed.note : null,
  }
}

export interface ScreenTimeRead {
  iphoneHours: number | null
  socialHours: number | null
  macHours: number | null
  note: string | null
}

export interface StatementRead {
  accountId: string | null
  firm: string | null
  size: number | null
  sizeLabel: string | null
  equity: number | null
  netPnl: number | null
  buffer: number | null
  stage: 'eval' | 'buffer' | 'payout' | 'failed' | 'paused' | null
  payout: number | null
  note: string | null
  confident: boolean
}

export async function readStatement(dataUrl: string): Promise<StatementRead> {
  const system = `You read a prop-firm account statement / dashboard screenshot (TakeProfitTrader, Lucid, TopStep, etc.).
Account stages: "eval" (evaluation), "buffer" (passed / in buffer), "payout" (profitable, taking payouts), "failed" (blown), "paused".
Extract from the screenshot:
- accountId: suggest an id like "lucid-50k-a" or "tpt-25k-b" from firm + account size + a suffix letter. null if you cannot tell the firm.
- firm: normalize firm names: "takeprofittrader" -> "tpt", "lucid" -> "lucid".
- size: account size in dollars (e.g. 50000, 25000). null if not visible.
- sizeLabel: e.g. "50k", "25k".
- equity: current account equity / balance if shown.
- netPnl: net profit or loss shown, else derive from equity vs starting balance if both visible.
- buffer: drawdown buffer remaining in dollars if shown.
- stage: infer from context — "eval" during evaluation, "buffer" once passed, "payout" if a payout was taken / is available, "failed" if blown.
- payout: a payout amount if one is visible (e.g. a recent payout row). null otherwise.
- note: one honest line on what the statement shows.
- confident: true ONLY if you could actually read the numbers; false if unclear or not a statement.
Output ONLY valid JSON with exactly those keys. Use null when unknown.`

  const rawJson = await orChat(
    [
      { role: 'system', content: system },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Read this prop-firm account statement screenshot:' },
          { type: 'image_url', image_url: { url: dataUrl } },
        ],
      },
    ],
    env.modelVision(),
    true,
    1200,
  )
  const p = tryJson<Partial<StatementRead>>(rawJson) ?? {}
  const stage = p.stage === 'eval' || p.stage === 'buffer' || p.stage === 'payout' || p.stage === 'failed' || p.stage === 'paused' ? p.stage : null
  return {
    accountId: typeof p.accountId === 'string' ? p.accountId : null,
    firm: typeof p.firm === 'string' ? p.firm : null,
    size: num(p.size),
    sizeLabel: typeof p.sizeLabel === 'string' ? p.sizeLabel : null,
    equity: num(p.equity),
    netPnl: num(p.netPnl),
    buffer: num(p.buffer),
    stage,
    payout: num(p.payout),
    note: typeof p.note === 'string' ? p.note : null,
    confident: p.confident === true,
  }
}

export async function readScreenTime(dataUrl: string): Promise<ScreenTimeRead> {
  const system = `You read screen-time / app-usage screenshots (iPhone Screen Time or MacOS Screen Time reports).
Extract:
- iphoneHours: total iPhone screen time in hours (decimal). Look for "screen time" total / average.
- socialHours: portion spent on social apps (instagram, tiktok, twitter/x, youtube, etc.) if shown; else null.
- macHours: total Mac/computer usage in hours if shown; else null.
- note: one honest line on what stands out (e.g. "heavy youtube at night").
Output ONLY valid JSON with keys: iphoneHours, socialHours, macHours, note. Use null when not visible. Round hours to 1 decimal.`

  const rawJson = await orChat(
    [
      { role: 'system', content: system },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Read this screen time screenshot:' },
          { type: 'image_url', image_url: { url: dataUrl } },
        ],
      },
    ],
    env.modelVision(),
    true,
    800,
  )
  const parsed = tryJson<Partial<ScreenTimeRead>>(rawJson) ?? {}
  return {
    iphoneHours: num(parsed.iphoneHours),
    socialHours: num(parsed.socialHours),
    macHours: num(parsed.macHours),
    note: typeof parsed.note === 'string' ? parsed.note : null,
  }
}

export type AssistKind = 'title' | 'summary' | 'polish' | 'caption'

export async function assist(text: string, kind: AssistKind): Promise<string> {
  const instructions: Record<AssistKind, string> = {
    title:
      'Write ONE short, human, understated journal title (max 8 words). No quotes. This is a personal trading journal — plain, honest, no clickbait.',
    summary:
      'Write a 1-2 sentence summary of the day in the trader\'s voice. Plain, honest, understated. No markdown.',
    polish:
      'Polish the markdown journal entry. Keep the voice identical and personal, fix grammar and flow, keep markdown structure, do not add fake detail. Return the full polished markdown.',
    caption: 'Write ONE short caption for a trading screenshot (max 10 words).',
  }
  const system = `You help a trader write his public journal. Tone: honest, plain, a little raw, zero hype. Respond with the ${kind} only, no commentary, no markdown fences.`
  const raw = await orChat(
    [
      { role: 'system', content: system },
      { role: 'user', content: `${instructions[kind]}\n\n${text.slice(0, 6000)}` },
    ],
    env.modelAssist(),
    false,
  )
  return raw.trim().replace(/^```(?:markdown)?\s*|\s*```$/g, '').trim()
}

export async function coachReply(
  snapshotText: string,
  history: { role: 'me' | 'coach'; text: string; when: string }[],
): Promise<string> {
  const system = `You are f-R-iend, the trader's personal coach on 1ed.ge — a public trading journal on the road to a hedge fund. R is the centerpiece (points risked vs points made).
Personality: direct, warm but unsentimental, a little raw. Zero hype, zero fluff.
Job: help the trader decipher the trends in their own data and act on them.
Rules:
- Ground every claim in the data you're given. Never invent statistics.
- Keep it short: 1-3 concrete suggestions or questions max. Ask the trader at least one question.
- Follow up on previous advice if it exists — acknowledge whether they acted on it.
- Be honest when the data says something uncomfortable.
- Format in markdown: short paragraphs / short list. Max ~180 words.`
  const messages: OrMessage[] = [
    { role: 'system', content: system },
    { role: 'user', content: `Here is the current trend snapshot:\n\n${snapshotText.slice(0, 6000)}` },
  ]
  if (history.length) {
    const transcript = history
      .map((h) => `${h.when} · ${h.role}:\n${h.text.slice(0, 900)}`)
      .join('\n\n')
    messages.push({
      role: 'user',
      content: `Previous conversation (most recent last):\n\n${transcript.slice(-12000)}`,
    })
  }
  const last = history[history.length - 1]
  if (last && last.role === 'me') {
    messages.push({ role: 'user', content: `The trader's latest message:\n\n${last.text.slice(0, 4000)}` })
  }
  const raw = await orChat(messages, env.modelAssist(), false, 1200)
  return raw.trim().replace(/^```(?:markdown)?\s*|\s*```$/g, '').trim()
}

export async function draftReflection(daySnapshot: string): Promise<string> {
  const system = `You are the journal writer for 1ed.ge. Given a structured summary of one trading day, write a first-draft reflection in the trader's voice.
Tone: plain, honest, a little raw. Zero hype. First person. Short paragraphs.
Rules:
- Ground EVERYTHING in the given data. Never invent trades, prices, moods or habits.
- Reference the actual trades (setup, direction, R), the mood, sleep, screen-time behaviour.
- End with one honest line — a lesson or a question for tomorrow.
- Markdown only, 2-4 short paragraphs. Max ~180 words.`
  const raw = await orChat(
    [
      { role: 'system', content: system },
      { role: 'user', content: `Today's day record:\n\n${daySnapshot.slice(0, 6000)}` },
    ],
    env.modelAssist(),
    false,
    900,
  )
  return raw.trim().replace(/^```(?:markdown)?\s*|\s*```$/g, '').trim()
}

export async function dailyBrief(snapshot: string): Promise<string> {
  const system = `You write the daily pre-market brief for 1ed.ge, a trader's public journal on the road to a hedge fund. R is the centerpiece.
Write ONE short markdown brief (~100-140 words) covering: today's market sessions, the key news events with their HKT times, and the trading context from the most recent day.
Tone: plain, honest, focused, zero hype. Ground EVERYTHING in the data you're given — never invent numbers, events, times or prices. Mention the news events by name and HKT time exactly as given. One short intro line, a line on the day's shape, a line on the news events, a closing line. No headings, no lists, no emojis.`
  const raw = await orChat(
    [
      { role: 'system', content: system },
      { role: 'user', content: `Pre-market data snapshot:\n\n${snapshot.slice(0, 6000)}` },
    ],
    env.modelAssist(),
    false,
    700,
  )
  return raw.trim().replace(/^```(?:markdown)?\s*|\s*```$/g, '').trim()
}

export function num(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v) : NaN
  return Number.isFinite(n) ? round2(n) : null
}
function int(v: unknown): number | null {
  const n = num(v)
  if (n === null) return null
  return Math.max(1, Math.min(5, Math.round(n)))
}

export async function captionAlt(dataUrl: string): Promise<string> {
  const system = `You write alt text for images in a trader's public journal (charts, screen-time reports, statements, notes).
Write ONE short, factual, SEO-friendly alt text (max 12 words). Describe what the image actually shows — instrument, direction, what happened. Plain and honest, zero hype, no quotes, no markdown.`
  const raw = await orChat(
    [
      { role: 'system', content: system },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Write alt text for this image:' },
          { type: 'image_url', image_url: { url: dataUrl } },
        ],
      },
    ],
    env.modelAlt(),
    false,
    60,
  )
  return raw.trim().replace(/^```\w*\s*|\s*```$/g, '').replace(/\.$/, '').trim()
}

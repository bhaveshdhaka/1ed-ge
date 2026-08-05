import { env } from './env'

interface OrPart {
  type: string
  text?: string
  image_url?: { url: string }
}

interface OrMessage {
  role: 'system' | 'user' | 'assistant'
  content: string | OrPart[]
}

async function orChat(messages: OrMessage[], model: string, json = true, maxTokens = 2500) {
  const key = env.openrouterKey()
  if (!key) throw new Error('OPENROUTER_API_KEY is not set')
  const res = await fetch(`${env.openrouterBase()}/chat/completions`, {
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
  })
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
}

export interface StructuredDay {
  mood: number | null
  sleepHours: number | null
  sleepQuality: number | null
  trades: StructuredTrade[]
}

const TRADE_SHAPE = `{
  "market": "MNQ",
  "session": "asia|london|ny-am|ny-pm|ny or null",
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
  "accounts": ["account id(s) from the list, or [] if unknown"]
}`

export async function structureDayNotes(raw: string, accountOptions: string[]): Promise<StructuredDay> {
  const system = `You convert a trader's raw, messy daily notes into structured JSON for one trading day.
Rules:
- Output ONLY valid JSON. No markdown fences, no prose.
- Use null when missing; empty array when none.
- direction is "long" or "short". riskPoints = |entry - stop|. points = signed net points (+profit/-loss).
- If notes describe multiple trades, list them all in "trades" (each trade = one setup/position; executions across accounts are not separate trades).
- If only one trade exists, trades has one element.
- accounts: pick from available account ids; if the trader names an account use it; if a trade was on multiple accounts list all; else [].
- mood: overall mood of the day 1-5 (null if not inferable). sleepHours: decimal hours if mentioned.
Available account ids: ${accountOptions.join(', ') || 'none'}
Return exactly:
{
  "mood": 1-5 or null,
  "sleepHours": number or null,
  "sleepQuality": 1-5 or null,
  "trades": [ ${TRADE_SHAPE} ]
}`

  const rawJson = await orChat(
    [
      { role: 'system', content: system },
      { role: 'user', content: `Raw day notes:\n\n${raw.slice(0, 12000)}` },
    ],
    env.modelStructure(),
    true,
    3500,
  )
  const parsed = tryJson<Partial<StructuredDay>>(rawJson)
  if (!parsed) throw new Error('AI returned unparseable JSON')
  const trades = Array.isArray(parsed.trades) ? parsed.trades : []
  return {
    mood: int(parsed.mood),
    sleepHours: num(parsed.sleepHours),
    sleepQuality: int(parsed.sleepQuality),
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
      accounts: Array.isArray(t?.accounts) ? t.accounts.map(String).filter((a) => accountOptions.includes(a)) : [],
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

function num(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v) : NaN
  return Number.isFinite(n) ? round2(n) : null
}
function int(v: unknown): number | null {
  const n = num(v)
  if (n === null) return null
  return Math.max(1, Math.min(5, Math.round(n)))
}
export function round2(n: number): number {
  return Math.round(n * 100) / 100
}

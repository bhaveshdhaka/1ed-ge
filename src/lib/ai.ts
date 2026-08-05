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

const TRADE_SHAPE = `{
  "date": "YYYY-MM-DD or null",
  "account": "account id or null",
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
  "note": "one-line summary or null"
}`

export interface StructuredTrade {
  date: string | null
  account: string | null
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
}

export async function structureTradeNotes(raw: string, accountOptions: string[]): Promise<StructuredTrade> {
  const system = `You convert a trader's raw, messy notes into one structured JSON trade record.
Rules:
- Output ONLY valid JSON. No markdown fences, no prose.
- Use null when a value is missing or cannot be determined.
- direction is "long" or "short".
- riskPoints = |entry - stop|.
- points = signed net points gained (+profit / -loss).
- If the notes describe multiple trades, pick the main/largest one and mention the others in note.
- Available account ids: ${accountOptions.join(', ') || 'unknown'}
Return exactly this shape:
${TRADE_SHAPE}`

  const rawJson = await orChat(
    [
      { role: 'system', content: system },
      { role: 'user', content: `Raw trade notes:\n\n${raw.slice(0, 8000)}` },
    ],
    env.modelStructure(),
    true,
  )
  const parsed = tryJson<Partial<StructuredTrade>>(rawJson)
  if (!parsed) throw new Error('AI returned unparseable JSON')
  return {
    date: typeof parsed.date === 'string' ? parsed.date : null,
    account: typeof parsed.account === 'string' ? parsed.account : null,
    market: typeof parsed.market === 'string' ? parsed.market.toUpperCase() : 'MNQ',
    session: typeof parsed.session === 'string' ? parsed.session : null,
    direction: parsed.direction === 'long' || parsed.direction === 'short' ? parsed.direction : null,
    setup: typeof parsed.setup === 'string' ? parsed.setup : null,
    entry: num(parsed.entry),
    stop: num(parsed.stop),
    target: num(parsed.target),
    exit: num(parsed.exit),
    riskPoints: num(parsed.riskPoints),
    points: num(parsed.points),
    confidence: int(parsed.confidence),
    note: typeof parsed.note === 'string' ? parsed.note : null,
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

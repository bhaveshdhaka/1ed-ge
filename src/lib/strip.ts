import { marketEvents, addDaysIso } from './sessions'
import type { MarketEvent, MarketKey } from './sessions'
import type { NewsItem } from './market-news'

/* ------------------------------------------------------------------ */
/* The market narrative strip.                                         */
/*                                                                     */
/* ONE source of truth for every conversational phrase the site        */
/* speaks about the market (homepage strip, footer, live ticker).      */
/* The server precomputes absolute-time segments; the browser only     */
/* picks the segment containing "now" and ticks the countdown. No      */
/* phrase logic is duplicated in inline JS.                            */
/* ------------------------------------------------------------------ */

export type StripCls = 'up' | 'warn' | 'down' | 'dim'

export interface StripSegment {
  market: MarketKey
  /** Segment start (ms, epoch). */
  at: number
  /** Countdown target — the next transition (ms, epoch). */
  until: number
  /** Narrative phrase WITHOUT the countdown; the client appends it. */
  text: string
  cls: StripCls
}

export interface NewsSegment {
  at: number
  text: string
  kind: 'red' | 'orange'
}

export interface StripPayload {
  segments: Record<MarketKey, StripSegment[]>
  /** One entry per red/orange event: "next red event: {title}"-style. */
  news: NewsSegment[]
  /** One entry per named speaker: "{Name} speaking". */
  speaker: NewsSegment[]
  now: number
}

const hktMs = (hkt: string) => Date.parse(hkt)
const isoStartMs = (iso: string) => Date.parse(`${iso}T00:00:00+08:00`)

/** Conversational duration: "3h 12m" · "12m" · "1d 3h" · "50s". */
export function fmtHuman(sec: number): string {
  sec = Math.max(0, Math.round(sec))
  const d = Math.floor(sec / 86400)
  const h = Math.floor((sec % 86400) / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.floor(sec % 60)
  if (d > 0) return h > 0 ? `${d}d ${h}h` : `${d}d`
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`
  if (m > 0) return `${m}m`
  return `${s}s`
}

/* ---------------- per-market state machine ---------------- */

type State =
  | 'closed' // not trading
  | 'open' // generic open (CME/LSE/NYSE)
  | 'maint' // CME maintenance halt
  | 'morning' // TSE morning session
  | 'lunch' // TSE lunch break
  | 'afternoon' // TSE afternoon session

const initialState: Record<MarketKey, State> = {
  cme: 'closed',
  tse: 'closed',
  lse: 'closed',
  nyse: 'closed',
}

function advance(market: MarketKey, state: State, e: MarketEvent): State {
  if (market === 'cme') {
    if (e.type === 'open' || e.type === 'resume') return 'open'
    if (e.type === 'halt') return 'maint'
    if (e.type === 'close') return 'closed'
    return state
  }
  if (market === 'tse') {
    if (e.type === 'open') {
      if (state === 'closed') return 'morning'
      if (state === 'lunch') return 'afternoon'
      return 'morning'
    }
    if (e.type === 'close') return e.label === 'lunch' ? 'lunch' : 'closed'
    return state
  }
  // lse / nyse
  if (e.type === 'open' || e.type === 'resume') return 'open'
  if (e.type === 'close' || e.type === 'halt') return 'closed'
  return state
}

/** Phrase for the span [prev, e) that ENDS when the next event fires.
 *  Name-less on purpose: the surrounding surface supplies the market name
 *  (row labels, footer master line, ticker). No "New York · NYSE New York opens in". */
function describe(market: MarketKey, state: State, e: MarketEvent): { text: string; cls: StripCls } {
  if (market === 'cme') {
    if (state === 'open') {
      return e.type === 'halt'
        ? { text: 'open · maintenance in', cls: 'up' }
        : { text: 'open · closes in', cls: 'up' }
    }
    if (state === 'maint') return { text: 'on maintenance · back in', cls: 'warn' }
    return { text: 'closed · reopens in', cls: 'down' }
  }
  if (market === 'tse') {
    if (state === 'morning') return { text: 'in session · closing for lunch in', cls: 'up' }
    if (state === 'lunch') return { text: 'on lunch break · back in', cls: 'warn' }
    if (state === 'afternoon') return { text: 'in session · closing in', cls: 'up' }
    return { text: 'opens in', cls: 'dim' }
  }
  if (market === 'lse') {
    return state === 'open'
      ? { text: 'is live · closing in', cls: 'up' }
      : { text: 'opens in', cls: 'dim' }
  }
  // nyse
  return state === 'open'
    ? { text: 'is live · closing in', cls: 'up' }
    : { text: 'opens in', cls: 'dim' }
}

/** Open-ended phrase when the horizon ends inside a state. Name-less too. */
function describeEnd(market: MarketKey, state: State): { text: string; cls: StripCls } {
  if (market === 'cme') {
    if (state === 'open') return { text: 'open', cls: 'up' }
    if (state === 'maint') return { text: 'on maintenance', cls: 'warn' }
    return { text: 'closed', cls: 'down' }
  }
  if (market === 'tse') {
    if (state === 'morning') return { text: 'in session', cls: 'up' }
    if (state === 'lunch') return { text: 'on lunch break', cls: 'warn' }
    if (state === 'afternoon') return { text: 'in session', cls: 'up' }
    return { text: 'closed', cls: 'dim' }
  }
  return state === 'open'
    ? { text: 'is live', cls: 'up' }
    : { text: 'closed', cls: 'dim' }
}

/** Display names surfaces attach when the name isn't already shown inline. */
export const MARKET_NAME: Record<MarketKey, string> = {
  cme: 'CME Globex',
  tse: 'Tokyo',
  lse: 'London',
  nyse: 'New York',
}

function buildMarket(market: MarketKey, evs: MarketEvent[], startMs: number, endMs: number): StripSegment[] {
  const sorted = evs
    .filter((e) => e.market === market)
    .sort((a, b) => hktMs(a.hkt) - hktMs(b.hkt))

  let state: State = initialState[market]
  for (const e of sorted) {
    const t = hktMs(e.hkt)
    if (t >= startMs) break
    state = advance(market, state, e)
  }

  const segs: StripSegment[] = []
  let tPrev = startMs
  for (const e of sorted) {
    const t = hktMs(e.hkt)
    if (t < startMs) continue
    if (t >= endMs) break
    if (t <= tPrev) continue
    const d = describe(market, state, e)
    segs.push({ market, at: tPrev, until: t, text: d.text, cls: d.cls })
    state = advance(market, state, e)
    tPrev = t
  }
  if (tPrev < endMs) {
    const d = describeEnd(market, state)
    segs.push({ market, at: tPrev, until: endMs, text: d.text, cls: d.cls })
  }
  return segs
}

/* ---------------- news: next red/orange + speaker ---------------- */

const SPEAKER_RULES: [RegExp, string][] = [
  [/trump/i, 'Trump'],
  [/powell/i, 'Powell'],
  [/fomc/i, 'FOMC'],
]

/** Named speaker from a title, if it reads like a speaking event. */
export function speakerFrom(title: string): string | null {
  for (const [re, name] of SPEAKER_RULES) {
    if (re.test(title)) return name
  }
  const m = title.match(/\b([A-Z][a-z]+)\s+(?:speaks?|remarks|speech|testif|holds|to speak)\b/i)
  return m ? m[1] : null
}

const NEWS_PREFIX: Record<'red' | 'orange', { text: string }> = {
  red: { text: 'next event: ' },
  orange: { text: 'next event: ' },
}

function newsAt(todayIso: string, hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return Date.parse(`${todayIso}T00:00:00+08:00`) + (h * 60 + m) * 60000
}

function buildNews(todayIso: string, red: NewsItem[], orange: NewsItem[]): { news: NewsSegment[]; speaker: NewsSegment[] } {
  const news: NewsSegment[] = []
  const speaker: NewsSegment[] = []
  const push = (item: NewsItem, kind: 'red' | 'orange') => {
    const at = newsAt(todayIso, item.time)
    news.push({ at, text: `${NEWS_PREFIX[kind].text}${item.title}`, kind })
    const name = speakerFrom(item.title)
    if (name) speaker.push({ at, text: `${name} speaking`, kind })
  }
  for (const it of red) push(it, 'red')
  for (const it of orange) push(it, 'orange')
  return { news, speaker }
}

/* ---------------- public builder ---------------- */

/**
 * Precompute narrative segments covering [today-1, today+3] HKT plus
 * today's news countdown segments. Serialized into the widget/footer;
 * the client picks the segment containing "now" and ticks `until - now`.
 */
export function buildStrip(
  todayIso: string,
  nowMs: number,
  red: NewsItem[],
  orange: NewsItem[],
): StripPayload {
  const evs = marketEvents(addDaysIso(todayIso, -1), 5)
  const startMs = isoStartMs(addDaysIso(todayIso, -1))
  const endMs = isoStartMs(addDaysIso(todayIso, 4))
  const { news, speaker } = buildNews(todayIso, red, orange)
  return {
    segments: {
      cme: buildMarket('cme', evs, startMs, endMs),
      tse: buildMarket('tse', evs, startMs, endMs),
      lse: buildMarket('lse', evs, startMs, endMs),
      nyse: buildMarket('nyse', evs, startMs, endMs),
    },
    news,
    speaker,
    now: nowMs,
  }
}

/** Current segment for a market at `now`. */
export function segmentAt(segs: StripSegment[], now: number): StripSegment | null {
  for (const s of segs) {
    if (now >= s.at && now < s.until) return s
  }
  return null
}

/** The next red (else orange) news line at `now`. */
export function nextNewsAt(news: NewsSegment[], now: number): NewsSegment | null {
  const upcoming = news.filter((n) => n.at > now)
  if (!upcoming.length) return null
  const red = upcoming.find((n) => n.kind === 'red')
  if (red) return red
  return upcoming.reduce((a, b) => (b.at < a.at ? b : a))
}

/** The next speaker line at `now`. */
export function nextSpeakerAt(speaker: NewsSegment[], now: number): NewsSegment | null {
  const upcoming = speaker.filter((n) => n.at > now)
  if (!upcoming.length) return null
  return upcoming.reduce((a, b) => (b.at < a.at ? b : a))
}

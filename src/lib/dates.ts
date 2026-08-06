const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'] as const

/** '2028-08-03' → '03-aug-2028' */
export function fmtDay(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}-${MONTHS[parseInt(m, 10) - 1]}-${y}`
}

/** '03-aug-2028' → '2028-08-03' (or null when the slug is malformed) */
export function parseDay(slug: string): string | null {
  const m = /^(\d{2})-([a-z]{3})-(\d{4})$/.exec(slug)
  if (!m) return null
  const mo = MONTHS.indexOf(m[2] as (typeof MONTHS)[number])
  if (mo < 0) return null
  return `${m[3]}-${String(mo + 1).padStart(2, '0')}-${m[1]}`
}

export function isIsoDay(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s)
}

const PROJECT_START = new Date('2026-08-05T00:00:00Z')
export function projectDayNumber(): number {
  return Math.min(730, Math.max(1, Math.floor((Date.now() - PROJECT_START.getTime()) / 86400000) + 1))
}

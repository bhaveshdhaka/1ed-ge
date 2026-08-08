/**
 * Per-account rule engine — owner-dictated, pure, no AI, no auto transitions.
 *
 * Composes the existing money math (stats.ts flatten/buildStats) — it NEVER
 * re-implements pnl/equity. All inputs are structural (duck-typed) so both
 * content-collection entries (accounts.astro) and fs-read frontmatter
 * (api/admin/accounts.ts) can be passed in directly.
 */

export interface AccountRuleFields {
  dailyLoss?: number | null // $ — max loss in one trading day
  breach?: 'drawdown' | 'daily' | 'either' | null // what ends the account
  consistency?: 'none' | 'eval' | 'funded' | 'both' | null // when consistency applies
  consistencyNote?: string | null // owner-authored free text — never generated
}

export interface AccountLike {
  id: string
  stage?: string | null
  drawdownLimit?: number | null
  trailing?: boolean
  rules?: AccountRuleFields | null
}

/** Per-account stat slice the engine reads from buildStats' AccountStat. */
export interface AccountStatLike {
  netPnl?: number
  drawdownLimit?: number
  trailing?: boolean
}

/** Execution row slice the engine reads from flatten()'s executions. */
export interface ExecutionLike {
  day: string
  account: string
  pnl: number
}

export interface AccountRuleStatus {
  configured: boolean // any rule field present (dailyLoss/breach/consistency/note)
  netPnl: number // $ net of payouts (reuse buildStats perAccount)
  drawdownLimit: number | null
  trailing: boolean
  drawdownHit: boolean // netPnl <= -drawdownLimit
  dailyLossLimit: number | null
  todayPnl: number // $ this HKT day (todayIso)
  worstDayPnl: number // $ worst single HKT day ever
  dailyHit: boolean // todayPnl <= -limit OR worstDayPnl <= -limit
  breach: 'drawdown' | 'daily' | 'none' | null // per the account's breach rule; null = no rule configured
  consistency: 'none' | 'eval' | 'funded' | 'both' | null
  consistencyApplies: boolean // current stage covered
}

export function accountRuleStatus(
  account: AccountLike,
  stat: AccountStatLike | null | undefined,
  executions: ExecutionLike[],
  todayIso: string,
): AccountRuleStatus {
  const rules = account.rules ?? {}
  const configured =
    rules.dailyLoss != null || rules.breach != null || rules.consistency != null || rules.consistencyNote != null

  // Drawdown (net of payouts — buildStats already nets them).
  const drawdownLimit = stat?.drawdownLimit ?? account.drawdownLimit ?? null
  const netPnl = stat?.netPnl ?? 0
  const trailing = stat?.trailing ?? account.trailing ?? true
  const drawdownHit = drawdownLimit != null && drawdownLimit > 0 && netPnl <= -drawdownLimit

  // Daily P&L per HKT day, straight from flatten's per-account executions.
  const byDay = new Map<string, number>()
  for (const e of executions) {
    if (e.account !== account.id) continue
    byDay.set(e.day, (byDay.get(e.day) ?? 0) + e.pnl)
  }
  const todayPnl = byDay.get(todayIso) ?? 0
  const worstDayPnl = byDay.size ? Math.min(...byDay.values()) : 0

  const dailyLossLimit =
    rules.dailyLoss != null && Number.isFinite(rules.dailyLoss) && rules.dailyLoss > 0 ? rules.dailyLoss : null
  const dailyHit = dailyLossLimit != null && (todayPnl <= -dailyLossLimit || worstDayPnl <= -dailyLossLimit)

  // Breach verdict per the account's own dictation.
  let breach: AccountRuleStatus['breach'] = null
  if (rules.breach) {
    if (rules.breach === 'drawdown') breach = drawdownHit ? 'drawdown' : 'none'
    else if (rules.breach === 'daily') breach = dailyHit ? 'daily' : 'none'
    else if (rules.breach === 'either') breach = drawdownHit ? 'drawdown' : dailyHit ? 'daily' : 'none'
  }

  // Consistency applicability against the current stage.
  const consistency = rules.consistency ?? null
  const stage = account.stage ?? ''
  let consistencyApplies = false
  if (consistency === 'eval') consistencyApplies = stage === 'eval'
  else if (consistency === 'funded') consistencyApplies = stage === 'funded'
  else if (consistency === 'both') consistencyApplies = stage === 'eval' || stage === 'funded'

  return {
    configured,
    netPnl,
    drawdownLimit,
    trailing,
    drawdownHit,
    dailyLossLimit,
    todayPnl,
    worstDayPnl,
    dailyHit,
    breach,
    consistency,
    consistencyApplies,
  }
}

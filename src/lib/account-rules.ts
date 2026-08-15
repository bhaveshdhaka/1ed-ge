/**
 * Per-account rule engine — owner-dictated, pure, no AI, no auto transitions.
 *
 * Composes the existing money math (stats.ts flatten/buildStats) — it NEVER
 * re-implements pnl/equity. All inputs are structural (duck-typed) so both
 * content-collection entries (accounts.astro) and fs-read frontmatter
 * (api/admin/accounts.ts) can be passed in directly.
 *
 * Rules are prop-firm-shaped: daily loss limit, profit target, consistency %,
 * buffer balance, drawdown mode (eod | intraday | intraday-to-eod) and the
 * trader's payout split. Presets prefill them when an account is created;
 * every value stays owner-editable.
 */

export interface AccountRuleFields {
  dailyLossLimit?: number | null // $ — DLL, max loss in one trading day (soft breach)
  profitTarget?: number | null // $ — eval profit target
  consistencyPct?: number | null // % — largest-day ≤ X%
  bufferBalance?: number | null // $ — MLL + 100, locks at this balance
  drawdownMode?: 'eod' | 'intraday' | 'intraday-to-eod' | null
  payoutSplit?: number | null // % — trader's cut
  lockout?: boolean | null // day locks at the DLL; next day resumes with drawdownLimit − dailyLossLimit
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
  configured: boolean // any rule field present (dailyLossLimit/consistencyPct/drawdownMode/bufferBalance/profitTarget)
  netPnl: number // $ net of payouts (reuse buildStats perAccount)
  drawdownLimit: number | null
  trailing: boolean // computed from drawdownMode — true unless intraday
  drawdownHit: boolean // netPnl <= -drawdownLimit
  dailyLossLimit: number | null
  todayPnl: number // $ this HKT day (todayIso)
  worstDayPnl: number // $ worst single HKT day ever
  dailyHit: boolean // todayPnl <= -limit OR worstDayPnl <= -limit
  breach: 'drawdown' | 'daily' | 'none' | null // computed from the math; null = nothing configured
  consistencyPct: number | null // the stored %
  consistencyApplies: boolean // true whenever the account HAS a consistency% (any stage)
  lockout: boolean // stored flag — trading locks for the day at the DLL
}

export function accountRuleStatus(
  account: AccountLike,
  stat: AccountStatLike | null | undefined,
  executions: ExecutionLike[],
  todayIso: string,
): AccountRuleStatus {
  const rules = account.rules ?? {}
  const configured =
    rules.dailyLossLimit != null ||
    rules.consistencyPct != null ||
    rules.drawdownMode != null ||
    rules.bufferBalance != null ||
    rules.profitTarget != null

  // Drawdown (net of payouts — buildStats already nets them).
  const drawdownLimit = stat?.drawdownLimit ?? account.drawdownLimit ?? null
  const netPnl = stat?.netPnl ?? 0
  const drawdownMode = rules.drawdownMode ?? 'eod'
  const trailing = drawdownMode !== 'intraday'
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
    rules.dailyLossLimit != null && Number.isFinite(rules.dailyLossLimit) && rules.dailyLossLimit > 0
      ? rules.dailyLossLimit
      : null
  const dailyHit = dailyLossLimit != null && (todayPnl <= -dailyLossLimit || worstDayPnl <= -dailyLossLimit)

  // Breach verdict — computed from the math; there's no stored breach rule anymore.
  // Only emitted when the account has any rule configured (null = bare account).
  let breach: AccountRuleStatus['breach'] = null
  if (configured) {
    if (drawdownHit) breach = 'drawdown'
    else if (dailyHit) breach = 'daily'
    else breach = 'none'
  }

  // Consistency — if the account HAS a consistency%, it applies (any stage).
  const consistencyPct = rules.consistencyPct ?? null
  const consistencyApplies = consistencyPct != null

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
    consistencyPct,
    consistencyApplies,
    lockout: rules.lockout === true,
  }
}

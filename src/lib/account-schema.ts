import { z } from 'zod'

/**
 * Account content schema — the single source of truth for the account file
 * shape. Imported by the content collection (content.config.ts) and by tests,
 * so the checked-in files, the admin write path, and the collection reads all
 * agree on ONE representation.
 *
 * Rule fields live NESTED under `rules:` — never flat at the top level. The
 * owner-dictated rule fields (daily loss limit, profit target, consistency %,
 * buffer balance, drawdown mode, payout split, lockout) are what the admin
 * AccountsTab edits and what accountRuleStatus() reads.
 */

export const accountStages = z.enum(['eval', 'funded', 'buffer', 'payout', 'failed', 'paused'])

export const accountRulesSchema = z.object({
  dailyLossLimit: z.number().positive().optional(), // DLL — daily soft breach; lockout trigger when lockout: true
  profitTarget: z.number().positive().optional(), // eval profit target
  consistencyPct: z.number().min(0).max(100).optional(), // % — largest-day ≤ X%
  bufferBalance: z.number().positive().optional(), // MLL + 100, locks at this balance
  drawdownMode: z.enum(['eod', 'intraday', 'intraday-to-eod']).default('eod'),
  payoutSplit: z.number().min(0).max(100).default(90), // trader's cut %
  lockout: z.boolean().default(false), // day locks at the DLL; next day resumes with drawdownLimit − dailyLossLimit
})

const accountStageEntry = z.object({
  stage: accountStages,
  from: z.string(),
  to: z.string().optional(),
  note: z.string().optional(),
})

export const accountSchema = z.object({
  id: z.string(),
  firm: z.string(),
  size: z.number(),
  sizeLabel: z.string(),
  drawdownLimit: z.number(), // total drawdown ($) — the account's max loss buffer
  trailing: z.boolean().default(true),
  contract: z.string().default('MNQ'),
  pointsValue: z.number(),
  riskPerTrade: z.number(),
  stage: accountStages,
  stages: z.array(accountStageEntry).default([]),
  note: z.string().optional(),
  platformIds: z.array(z.string()).default([]),
  rules: accountRulesSchema.optional(),
})

export type AccountRules = z.infer<typeof accountRulesSchema>
export type AccountEntry = z.infer<typeof accountSchema>

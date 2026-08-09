import { defineCollection, z } from 'astro:content'
import { glob } from 'astro/loaders'

const accountStages = z.enum(['eval', 'funded', 'buffer', 'payout', 'failed', 'paused'])

const accounts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/accounts' }),
  schema: z.object({
    id: z.string(),
    firm: z.string(),
    size: z.number(),
    sizeLabel: z.string(),
    drawdownLimit: z.number(),
    trailing: z.boolean().default(true),
    contract: z.string().default('MNQ'),
    pointsValue: z.number(),
    riskPerTrade: z.number(),
    stage: accountStages,
    stages: z
      .array(
        z.object({
          stage: accountStages,
          from: z.string(),
          to: z.string().optional(),
          note: z.string().optional(),
        }),
      )
      .default([]),
    note: z.string().optional(),
    platformIds: z.array(z.string()).default([]),
    rules: z
      .object({
        dailyLossLimit: z.number().positive().optional(), // DLL — daily soft breach
        profitTarget: z.number().positive().optional(), // eval profit target
        consistencyPct: z.number().min(0).max(100).optional(), // % — largest-day ≤ X%
        bufferBalance: z.number().positive().optional(), // MLL + 100, locks at this balance
        drawdownMode: z.enum(['eod', 'intraday', 'intraday-to-eod']).default('eod'),
        payoutSplit: z.number().min(0).max(100).default(90), // trader's cut %
      })
      .optional(),
  }),
})

const execution = z.object({
  account: z.string(),
  size: z.number().positive().optional(),
  note: z.string().optional(),
})

const trade = z.object({
  market: z.string().default('MNQ'),
  session: z.string().optional(),
  direction: z.enum(['long', 'short']),
  setup: z.string().optional(),
  model: z.string().optional(),
  entry: z.number(),
  stop: z.number().optional(),
  target: z.number().optional(),
  exit: z.number(),
  riskPoints: z.number().positive().optional(),
  points: z.number(),
  confidence: z.number().int().min(1).max(5).optional(),
  note: z.string().optional(),
  commentary: z.string().optional(),
  screenshots: z.array(z.string()).default([]),
  executions: z.array(execution).default([]),
})

const momentType = z.enum(['trade', 'note', 'quote'])

const moment = z.object({
  at: z.string(),
  type: momentType,
  text: z.string().optional(),
  tradeIdx: z.number().int().nonnegative().optional(),
  images: z.array(z.string()).default([]),
  author: z.string().optional(),
})

const device = z
  .object({
    iphoneHours: z.number().optional(),
    socialHours: z.number().optional(),
    macHours: z.number().optional(),
    notes: z.string().optional(),
    screenshots: z.array(z.string()).default([]),
  })
  .optional()

const days = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/days' }),
  schema: z.object({
    date: z.string(),
    mood: z.number().int().min(1).max(5).optional(),
    sleep: z
      .object({
        hours: z.number().optional(),
        quality: z.number().int().min(1).max(5).optional(),
      })
      .optional(),
    habits: z.record(z.string(), z.union([z.boolean(), z.number()])).optional(),
    device,
    trades: z.array(trade).default([]),
    stream: z.array(moment).default([]),
    draft: z
      .object({
        reflection: z.string().optional(),
        moments: z.array(moment).default([]),
      })
      .optional(),
  }),
})

const payouts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/payouts' }),
  schema: z.object({
    date: z.string(),
    account: z.string(),
    amount: z.number(),
    status: z.enum(['paid', 'pending']).default('paid'),
    note: z.string().optional(),
  }),
})

const coach = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/coach' }),
  schema: z.object({
    date: z.string(),
    summary: z.string().optional(),
  }),
})

const brief = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/brief' }),
  schema: z.object({
    date: z.string(),
  }),
})

const journal = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/journal' }),
  schema: z.object({
    date: z.string(),
    day: z.string().optional(),
    summary: z.string().optional(),
    tags: z.array(z.string()).default([]),
    tradeRefs: z.array(z.string()).optional(),
    featuredImage: z.string().optional(),
  }),
})

const newsEvent = z.object({
  time: z.string(),
  currency: z.string().default('USD'),
  title: z.string(),
  source: z.enum(['TV', 'FF']).optional(),
  verified: z.boolean().default(false),
})

const newsList = z.preprocess((v) => (v == null ? [] : v), z.array(newsEvent))

const marketNews = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/market-news' }),
  schema: z.object({
    date: z.string(),
    verified: z.boolean().default(false),
    cachedAt: z.string().optional(),
    red: newsList.default([]),
    orange: newsList.default([]),
  }),
})

const habits = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/habits' }),
  schema: z.object({
    name: z.string(),
    emoji: z.string().optional(),
    color: z.string().default('#6ea88a'),
    description: z.string().optional(),
    kind: z.enum(['bool', 'count']).default('bool'),
    target: z.number().optional(),
    category: z.string().default('general'),
    order: z.number().default(0),
    active: z.boolean().default(true),
  }),
})

const models = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/models' }),
  schema: z.object({
    name: z.string(),
    premise: z.string().optional(),
    rules: z.array(z.string()).default([]),
    status: z.enum(['active', 'paused', 'retired']).default('active'),
    order: z.number().default(0),
  }),
})

const rules = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/rules' }),
  schema: z.object({
    title: z.string(),
  }),
})

const reviews = defineCollection({
  loader: glob({ pattern: ['**/*.md', '!**/*.cmp.md'], base: './src/content/reviews' }),
  schema: z.object({
    type: z.enum(['week', 'month', 'quarter', 'half', 'year']),
    anchor: z.string(),
    title: z.string().optional(),
    date: z.string(),
  }),
})

const quotes = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/quotes' }),
  schema: z.object({
    text: z.string(),
    author: z.string().optional(),
  }),
})

export const collections = { accounts, days, payouts, coach, journal, habits, models, brief, 'market-news': marketNews, rules, quotes, reviews }

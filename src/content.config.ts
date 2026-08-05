import { defineCollection, z } from 'astro:content'
import { glob } from 'astro/loaders'

const accountStages = z.enum(['eval', 'buffer', 'payout', 'failed', 'paused'])

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
  entry: z.number(),
  stop: z.number().optional(),
  target: z.number().optional(),
  exit: z.number(),
  riskPoints: z.number().positive().optional(),
  points: z.number(),
  confidence: z.number().int().min(1).max(5).optional(),
  note: z.string().optional(),
  screenshots: z.array(z.string()).default([]),
  executions: z.array(execution).default([]),
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
    habits: z.record(z.string(), z.boolean()).optional(),
    device,
    trades: z.array(trade).default([]),
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

const habits = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/habits' }),
  schema: z.object({
    name: z.string(),
    emoji: z.string().optional(),
    color: z.string().default('#4ade80'),
    description: z.string().optional(),
  }),
})

export const collections = { accounts, days, payouts, coach, journal, habits }

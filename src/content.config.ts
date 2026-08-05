import { defineCollection, z } from 'astro:content'
import { glob } from 'astro/loaders'

const accounts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/accounts' }),
  schema: z.object({
    firm: z.string(),
    size: z.number(),
    sizeLabel: z.string(),
    drawdownLimit: z.number(),
    trailing: z.boolean().default(true),
    contract: z.string().default('MNQ'),
    pointsValue: z.number(),
    riskPerTrade: z.number(),
    status: z.enum(['active', 'passed', 'paused', 'lost']),
    started: z.string(),
    ended: z.string().optional(),
    note: z.string().optional(),
  }),
})

const trades = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/trades' }),
  schema: z.object({
    date: z.string(),
    account: z.string(),
    market: z.string().default('MNQ'),
    session: z.string().optional(),
    direction: z.enum(['long', 'short']),
    setup: z.string().optional(),
    entry: z.number(),
    stop: z.number(),
    target: z.number().optional(),
    exit: z.number(),
    riskPoints: z.number().positive(),
    points: z.number(),
    confidence: z.number().int().min(1).max(5).optional(),
    screenshots: z.array(z.string()).default([]),
    note: z.string().optional(),
  }),
})

const journal = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/journal' }),
  schema: z.object({
    date: z.string(),
    day: z.string().optional(),
    summary: z.string().optional(),
    tags: z.array(z.string()).default([]),
    mood: z.number().int().min(1).max(5).optional(),
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

const habitLog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/habit-log' }),
  schema: z.object({
    date: z.string(),
    note: z.string().optional(),
    values: z.record(z.string(), z.boolean()),
  }),
})

export const collections = { accounts, trades, journal, habits, habitLog }

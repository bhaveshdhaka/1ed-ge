import { z } from 'zod'

/**
 * Private routine event — the unified ledger shape.
 * Every routine (quiet, nature, exercise, intentions, rewiring, 21days)
 * writes the same shape. Date is always HKT.
 */
export const routineActivity = z.enum([
  'quiet',
  'nature',
  'exercise',
  'intentions',
  'rewiring',
  '21days',
])

export const routineEventSchema = z.object({
  date: z.string(), // HKT YYYY-MM-DD
  completedAt: z.string(), // ISO 8601
  activity: routineActivity,
  minutes: z.number().optional(),
  mood: z.string().optional(), // better/same/worse (nature) or 1-5
  practice: z.string().optional(), // 21days practice choice
})

export type RoutineActivity = z.infer<typeof routineActivity>
export type RoutineEvent = z.infer<typeof routineEventSchema>

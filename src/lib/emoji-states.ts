/** Word + emoji pickers for mood (1-5) and sleep quality (1-5).
 *  The data persists as a 1-5 integer; this is the render layer. */

export const MOODS = [
  { value: 1, emoji: '😞', label: 'rough' },
  { value: 2, emoji: '😕', label: 'off' },
  { value: 3, emoji: '😐', label: 'okay' },
  { value: 4, emoji: '🙂', label: 'good' },
  { value: 5, emoji: '😄', label: 'great' },
] as const

export const SLEEP_QUALITIES = [
  { value: 1, emoji: '😵', label: 'exhausted' },
  { value: 2, emoji: '😴', label: 'groggy' },
  { value: 3, emoji: '😐', label: 'okay' },
  { value: 4, emoji: '😊', label: 'rested' },
  { value: 5, emoji: '⚡', label: 'well rested' },
] as const

export function moodByValue(v: number | string | null | undefined) {
  const n = Number(v)
  return MOODS.find((m) => m.value === n) ?? null
}

export function sleepByValue(v: number | string | null | undefined) {
  const n = Number(v)
  return SLEEP_QUALITIES.find((s) => s.value === n) ?? null
}

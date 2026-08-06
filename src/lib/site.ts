export const THEMES = ['summit', 'aurora', 'mono'] as const
export type ThemeName = (typeof THEMES)[number]
export const DEFAULT_THEME: ThemeName = 'summit'

export const THEME_LABELS: Record<ThemeName, { label: string; tagline: string }> = {
  summit: { label: 'summit', tagline: 'starry sky · mountain ridge · peak mark' },
  aurora: { label: 'aurora', tagline: 'drifting nebula fields · flowing mark' },
  mono: { label: 'mono', tagline: 'hairline precision · dot grid · no glow' },
}

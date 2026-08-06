import type { APIRoute } from 'astro'
import fs from 'node:fs'
import path from 'node:path'
import { authorized, json, error } from '../../../lib/auth'
import { ROOT } from '../../../lib/content'
import { addChange } from '../../../lib/changes'
import { THEMES, DEFAULT_THEME, type ThemeName } from '../../../lib/site'

export const prerender = false

const FILE = path.join(ROOT, 'src/config/site.json')

export function getTheme(): string {
  try {
    const cfg = JSON.parse(fs.readFileSync(FILE, 'utf8'))
    if (THEMES.includes(cfg.theme)) return cfg.theme
  } catch {}
  return DEFAULT_THEME
}

export const GET: APIRoute = async ({ request }) => {
  if (!authorized(request)) return error('unauthorized', 401)
  return json({ ok: true, theme: getTheme(), themes: THEMES })
}

export const POST: APIRoute = async ({ request }) => {
  if (!authorized(request)) return error('unauthorized', 401)
  const body = await request.json().catch(() => ({}))
  const theme = String(body.theme ?? '')
  if (!THEMES.includes(theme as ThemeName)) return error('unknown theme — choose summit, aurora, or mono')
  fs.mkdirSync(path.dirname(FILE), { recursive: true })
  fs.writeFileSync(FILE, JSON.stringify({ theme }, null, 2) + '\n')
  addChange('theme', `theme → ${theme}`, 'the whole site re-skins on rebuild')
  return json({ ok: true, theme })
}

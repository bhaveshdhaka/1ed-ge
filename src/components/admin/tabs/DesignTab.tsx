import { useCallback, useEffect, useState } from 'react'
import { api, getSecret, notifyChanged } from '../api'
import { Card, Button } from '../ui'
import { THEMES, THEME_LABELS } from '../../../lib/site'
import type { ThemeName } from '../../../lib/site'

interface ThemeState {
  theme: string
  themes: string[]
}

export function DesignTab({ notify }: { notify: (m: string, ok?: boolean) => void }) {
  const [current, setCurrent] = useState<string>('summit')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await api<ThemeState>('/api/admin/theme')
      setCurrent(res.theme)
    } catch (e) {
      notify(e instanceof Error ? e.message : 'load failed', false)
    }
    setLoading(false)
  }, [notify])

  useEffect(() => {
    load()
  }, [load])

  const apply = async (theme: string) => {
    setSaving(theme)
    try {
      await api('/api/admin/theme', { method: 'POST', body: { theme } })
      notify(`theme → ${theme} — rebuild to apply site-wide`)
      notifyChanged()
      setCurrent(theme)
    } catch (e) {
      notify(e instanceof Error ? e.message : 'apply failed', false)
    }
    setSaving(null)
  }

  if (loading) return <Card title="design"><p className="text-[13px] text-faint">loading…</p></Card>

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl">/ design</h1>
        <span className="text-[12px] text-dim">live theme: <span className="text-accent">{current}</span></span>
      </div>

      <p className="text-[12px] leading-relaxed text-dim">
        pick a look, then <span className="text-ink">apply</span> — it queues a rebuild and the whole site
        re-skins (background, logo, accent colors). public pages stay zero-JS.
      </p>

      <div className="grid gap-6 lg:grid-cols-3">
        {(THEMES as readonly string[]).map((name) => {
          const info = THEME_LABELS[name as ThemeName]
          const active = name === current
          return (
            <Card
              key={name}
              title={`${info.label}${active ? ' · current' : ''}`}
              actions={
                <Button
                  size="sm"
                  variant={active ? '' : 'primary'}
                  onClick={() => apply(name)}
                  disabled={active || saving !== null}
                  data-theme={name}
                >
                  {saving === name ? 'saving…' : active ? 'applied' : 'apply'}
                </Button>
              }
            >
              <div className="mb-2 text-[11px] text-faint">{info.tagline}</div>
              <iframe
                src={`/admin/${getSecret()}/preview/theme/${name}`}
                title={`${name} theme preview`}
                loading={active ? 'eager' : 'lazy'}
                className="h-64 w-full border border-line bg-bg"
              />
            </Card>
          )
        })}
      </div>
    </div>
  )
}

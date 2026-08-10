import { useEffect, useState } from 'react'
import { parseOptionsFromJSON } from './webauthn-options'

export default function LoginScreen() {
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<{ hasPasskeys: boolean; authed: boolean } | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/webauthn/status')
      .then((r) => r.json())
      .then((d) => setStatus(d))
      .catch(() => setStatus({ hasPasskeys: false, authed: false }))
  }, [])

  const signIn = async () => {
    setBusy(true)
    setErr(null)
    try {
      const begin = await fetch('/api/webauthn/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      const { options, nonce, error: beginErr } = await begin.json()
      if (!begin.ok || beginErr) throw new Error(beginErr || 'begin failed')
      const credential = await navigator.credentials.get({ publicKey: parseOptionsFromJSON<PublicKeyCredentialRequestOptions>(options) })
      if (!credential) throw new Error('no credential')
      const verify = await fetch('/api/webauthn/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nonce, credential }),
      })
      const v = await verify.json()
      if (!verify.ok) throw new Error(v.error || 'verify failed')
      window.location.reload()
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }

  if (!status) return <div className="shell py-24 text-sm text-faint">…</div>
  if (!status.hasPasskeys) {
    return (
      <div className="shell py-24 text-sm text-dim">
        no passkey registered yet — open <span className="text-ink">/zen/setup</span> from your
        recovery URL to register one.
      </div>
    )
  }

  return (
    <div className="shell flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <h1 className="text-xl">admin</h1>
      <p className="text-sm text-dim">sign in with your passkey</p>
      <button
        className="h-10 border border-line px-5 text-sm transition-colors hover:border-accent"
        onClick={signIn}
        disabled={busy}
      >
        {busy ? '…' : 'sign in'}
      </button>
      {err && <p className="text-xs text-down">{err}</p>}
    </div>
  )
}

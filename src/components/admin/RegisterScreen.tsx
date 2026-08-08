import { useState } from 'react'

export default function RegisterScreen() {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const key = new URLSearchParams(window.location.search).get('key') ?? ''

  const register = async () => {
    setBusy(true)
    setErr(null)
    try {
      const begin = await fetch('/api/webauthn/register', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key }),
      })
      const { options, nonce, error: beginErr } = await begin.json()
      if (!begin.ok || beginErr) throw new Error(beginErr || 'begin failed')
      const credential = await navigator.credentials.create({ publicKey: options as PublicKeyCredentialCreationOptions })
      if (!credential) throw new Error('no credential')
      const verify = await fetch('/api/webauthn/register', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, nonce, credential }),
      })
      const v = await verify.json()
      if (!verify.ok) throw new Error(v.error || 'verify failed')
      setDone(true)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }

  if (done) {
    return (
      <div className="text-[13px]">
        <p className="text-up">✓ passkey registered.</p>
        <a className="mt-4 inline-block border border-line px-4 py-2 hover:border-accent" href="/zen">open zen →</a>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-start gap-3">
      <button
        className="h-10 border border-line px-5 text-[13px] transition-colors hover:border-accent"
        onClick={register}
        disabled={busy}
      >
        {busy ? '…' : 'register passkey'}
      </button>
      {err && <p className="text-[12px] text-down">{err}</p>}
    </div>
  )
}

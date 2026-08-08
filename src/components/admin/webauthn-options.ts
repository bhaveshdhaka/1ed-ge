/**
 * WebAuthn JSON options → browser-ready options.
 *
 * The server's generate*Options() emit the *JSON* shapes, where challenge,
 * user.id, allowCredentials[].id and excludeCredentials[].id are base64url
 * STRINGS. WebIDL requires those fields to be BufferSource (ArrayBuffer /
 * TypedArray) — a raw cast does not convert, and conforming browsers throw a
 * TypeError at the navigator.credentials.get/create boundary. Decode just
 * those fields to Uint8Array; everything else (including the `type:
 * 'public-key'` the server already stamps on descriptors) passes through
 * unchanged. Client-only (atob is a browser global).
 */

interface JsonCredentialDescriptor {
  id?: string
  type?: string
  transports?: string[]
}

function b64urlToBytes(s: string): Uint8Array<ArrayBuffer> {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(b64)
  const bytes = new Uint8Array(new ArrayBuffer(bin.length))
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

function decodeDescriptors(list?: JsonCredentialDescriptor[]): PublicKeyCredentialDescriptor[] | undefined {
  if (!Array.isArray(list)) return undefined
  return list.map((d) => ({
    id: b64urlToBytes(d.id ?? ''),
    type: (d.type ?? 'public-key') as PublicKeyCredentialType,
    ...(Array.isArray(d.transports) ? { transports: d.transports as AuthenticatorTransport[] } : {}),
  }))
}

export function parseOptionsFromJSON<T>(json: Record<string, unknown>): T {
  const { challenge, user, allowCredentials, excludeCredentials, ...rest } = json as {
    challenge?: unknown
    user?: { id?: unknown } & Record<string, unknown>
    allowCredentials?: JsonCredentialDescriptor[]
    excludeCredentials?: JsonCredentialDescriptor[]
  }
  return {
    ...rest,
    challenge: typeof challenge === 'string' ? b64urlToBytes(challenge) : challenge,
    ...(user && typeof user.id === 'string' ? { user: { ...user, id: b64urlToBytes(user.id) } } : {}),
    ...(allowCredentials ? { allowCredentials: decodeDescriptors(allowCredentials) } : {}),
    ...(excludeCredentials ? { excludeCredentials: decodeDescriptors(excludeCredentials) } : {}),
  } as T
}

import {
  generateRegistrationOptions,
  generateAuthenticationOptions,
  verifyRegistrationResponse,
  verifyAuthenticationResponse,
  type RegistrationResponseJSON,
  type AuthenticationResponseJSON,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
  type AuthenticatorTransportFuture,
} from '@simplewebauthn/server'
import crypto from 'node:crypto'
import { env } from './env'
import {
  readCredentials,
  saveCredential,
  clearSessions,
  saveSession,
  touchSession,
  readSessions,
  setChallenge,
  getChallenge,
} from './passkeys'

const SESSION_TTL = 30 * 24 * 3600 * 1000
export const COOKIE = 'zen_session'
const RP_NAME = '1ed.ge'
const USER_ID = new Uint8Array([1]) // single-user site

export const rpId = () => new URL(env.siteUrl()).hostname
export const origin = () => new URL(env.siteUrl()).origin

export function hasPasskeys(): boolean {
  return readCredentials().length > 0
}

export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  return crypto.timingSafeEqual(ab, bb)
}

// --- sessions ---
export function issueSession(): string {
  const token = crypto.randomBytes(32).toString('base64url')
  saveSession(token, SESSION_TTL)
  return token
}
export function sessionCookie(token: string) {
  return {
    value: token,
    opts: { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 30 * 24 * 3600 },
  }
}
/** Full Set-Cookie header value for a session token (single source of truth for the string). */
export function sessionCookieHeader(token: string): string {
  return `${COOKIE}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${30 * 24 * 3600}`
}
export function sessionOk(request: Request): boolean {
  const cookie = request.headers.get('cookie') ?? ''
  const m = cookie.split(';').map((s) => s.trim()).find((s) => s.startsWith(`${COOKIE}=`))
  if (!m) return false
  const token = m.slice(COOKIE.length + 1)
  if (!token) return false
  return touchSession(token, SESSION_TTL)
}
/** Read-only session check: token present + unexpired. No sliding, no disk write. */
export function sessionPresent(request: Request): boolean {
  const cookie = request.headers.get('cookie') ?? ''
  const m = cookie.split(';').map((s) => s.trim()).find((s) => s.startsWith(`${COOKIE}=`))
  if (!m) return false
  const token = m.slice(COOKIE.length + 1)
  if (!token) return false
  const session = readSessions().find((s) => s.token === token)
  if (!session) return false
  return Date.now() <= session.expiresAt
}

// --- registration ---
export async function registerBegin(): Promise<{
  options: PublicKeyCredentialCreationOptionsJSON
  nonce: string
}> {
  const existing = readCredentials().map((c) => ({ id: c.id }))
  const nonce = crypto.randomUUID()
  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: rpId(),
    userName: 'owner',
    userID: USER_ID,
    userDisplayName: 'Owner',
    attestationType: 'none',
    authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
    excludeCredentials: existing,
  })
  setChallenge(nonce, options.challenge)
  return { options, nonce }
}

export async function registerVerify(
  nonce: string,
  credential: RegistrationResponseJSON,
): Promise<boolean> {
  const challenge = getChallenge(nonce)
  if (!challenge) return false
  const verification = await verifyRegistrationResponse({
    response: credential,
    expectedChallenge: challenge,
    expectedOrigin: origin(),
    expectedRPID: rpId(),
  })
  if (!verification.verified || !verification.registrationInfo) return false
  // v13 nests the credential fields (id/publicKey/counter) inside registrationInfo.credential
  const { credential: regCredential } = verification.registrationInfo
  const { id: credentialID, publicKey: credentialPublicKey, counter } = regCredential
  saveCredential({
    id: credentialID,
    publicKey: Buffer.from(credentialPublicKey).toString('base64url'),
    counter,
    transports: credential.response.transports ?? [],
    createdAt: new Date().toISOString(),
  })
  clearSessions() // revoke: any old passkey stops working immediately
  return true
}

// --- login ---
export async function loginBegin(): Promise<{
  options: PublicKeyCredentialRequestOptionsJSON
  nonce: string
} | null> {
  const creds = readCredentials()
  if (creds.length === 0) return null
  const nonce = crypto.randomUUID()
  const options = await generateAuthenticationOptions({
    rpID: rpId(),
    allowCredentials: creds.map((c) => ({ id: c.id, transports: c.transports as AuthenticatorTransportFuture[] })),
    userVerification: 'required',
  })
  setChallenge(nonce, options.challenge)
  return { options, nonce }
}

export async function loginVerify(
  nonce: string,
  credential: AuthenticationResponseJSON,
): Promise<boolean> {
  const challenge = getChallenge(nonce)
  if (!challenge) return false
  const creds = readCredentials()
  const stored = creds.find((c) => c.id === credential.id)
  if (!stored) return false
  const verification = await verifyAuthenticationResponse({
    response: credential,
    expectedChallenge: challenge,
    expectedOrigin: origin(),
    expectedRPID: rpId(),
    credential: {
      id: stored.id,
      publicKey: Uint8Array.from(Buffer.from(stored.publicKey, 'base64url')),
      counter: stored.counter,
    },
  })
  if (!verification.verified) return false
  saveCredential({ ...stored, counter: verification.authenticationInfo.newCounter })
  return true
}

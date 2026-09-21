/**
 * Who is signed in.
 *
 * A wallet, proven by a signature, and nothing else: no password to store, no email to leak. The session is
 * a signed cookie, so the server keeps no session table and a stolen database row cannot impersonate anyone.
 *
 * Proving a wallet is NOT permission to spend from it. Every transaction that moves money is still signed by
 * the owner in their own wallet, or by the worker's operator key inside the contract's limits.
 */
import { getIronSession, type SessionOptions } from 'iron-session'
import { cookies } from 'next/headers'

export interface Session {
  /** Lower case, always. The one place a desk is tied to a person. */
  address?: string
  /** Proven at. A session older than the cookie's own life cannot exist, but this is what the UI shows. */
  signedInAt?: string
  /** The nonce handed out for the message being signed. One use, then gone. */
  nonce?: string | undefined
}

const password = process.env.SESSION_SECRET

export const sessionOptions: SessionOptions = {
  password: password ?? '',
  cookieName: 'desk_session',
  cookieOptions: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 7,
  },
}

export async function getSession() {
  if (!password || password.length < 32) {
    throw new Error('SESSION_SECRET is missing or too short. It must be at least 32 characters.')
  }
  return getIronSession<Session>(await cookies(), sessionOptions)
}

/** The signed-in address, or undefined. Every owner query starts here and is scoped by it. */
export async function signedInAddress(): Promise<string | undefined> {
  const session = await getSession()
  return session.address
}

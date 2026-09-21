import { randomBytes } from 'node:crypto'
import { getSession } from '@/lib/session'

/** A fresh nonce for one sign-in. It lives in the session cookie, so a message signed for us cannot be replayed. */
export async function GET() {
  const session = await getSession()
  session.nonce = randomBytes(16).toString('hex')
  await session.save()
  return Response.json({ nonce: session.nonce })
}

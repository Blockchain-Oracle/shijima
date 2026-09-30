import { ensureOwner } from '@desk/db'
import { PrivyClient } from '@privy-io/node'
import { db } from '@/lib/db'
import { emailIdentity } from '@/lib/email-identity'
import { sameOrigin } from '@/lib/origin'
import { getSession } from '@/lib/session'

export async function POST(request: Request) {
  if (!sameOrigin(request))
    return Response.json({ error: 'That request came from another site.' }, { status: 403 })
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID
  const appSecret = process.env.PRIVY_APP_SECRET
  if (!appId || !appSecret)
    return Response.json({ error: 'Email sign-in is not configured yet.' }, { status: 503 })
  const token = request.headers.get('authorization')?.match(/^Bearer (\S+)$/)?.[1]
  if (!token || token.length > 8192)
    return Response.json({ error: 'Sign in with email first.' }, { status: 401 })
  let body: { address?: unknown; link?: unknown }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid request.' }, { status: 400 })
  }
  if (typeof body.address !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(body.address)) {
    return Response.json({ error: 'Choose a wallet linked to your email.' }, { status: 400 })
  }
  const client = new PrivyClient({ appId, appSecret })
  let identity: ReturnType<typeof emailIdentity>
  let userId: string
  try {
    const claims = await client.utils().auth().verifyAccessToken(token)
    // Fetch current links from Privy: an unlinked wallet cannot sign in through an older identity token.
    const user = await client.users()._get(claims.user_id)
    userId = user.id
    identity = emailIdentity(user.linked_accounts, body.address)
  } catch {
    return Response.json(
      { error: 'Could not verify your email session. Request another code.' },
      { status: 401 },
    )
  }
  if (!identity)
    return Response.json({ error: 'That email and wallet have not both been verified.' }, { status: 403 })
  const session = await getSession()
  if (body.link === true && (!session.address || session.address !== identity.address)) {
    return Response.json({ error: 'Sign in with the wallet you want to link first.' }, { status: 403 })
  }
  try {
    await ensureOwner(db(), identity.address)
    delete session.nonce
    session.address = identity.address
    session.email = identity.email
    session.privyUserId = userId
    session.signedInAt = new Date().toISOString()
    await session.save()
    return Response.json({ address: identity.address }, { headers: { 'cache-control': 'no-store' } })
  } catch {
    return Response.json({ error: 'Could not save your sign-in. Try again.' }, { status: 503 })
  }
}

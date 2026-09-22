import { CHAIN_ID, makePublicClient } from '@desk/chain'
import { ensureOwner } from '@desk/db'
import { errorText } from '@desk/shared'
import { db } from '@/lib/db'
import { sameOrigin } from '@/lib/origin'
import { getSession } from '@/lib/session'

/**
 * Proves a wallet. The message must carry the nonce WE issued, this exact site and this chain, so a signature
 * collected anywhere else cannot be used here. A smart-account wallet is supported too, which is why this
 * verifies through a chain client rather than recovering an address locally.
 *
 * Proving a wallet creates the owner's row, so the disclosure can be accepted before any desk exists.
 */
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return Response.json({ error: 'That request came from another site.' }, { status: 403 })
  const session = await getSession()
  try {
    const { message, signature } = (await request.json()) as { message: string; signature: `0x${string}` }
    if (!session.nonce) return Response.json({ error: 'Ask for a nonce first.' }, { status: 400 })

    const url = new URL(request.url)
    const valid = await makePublicClient().verifySiweMessage({
      message,
      signature,
      nonce: session.nonce,
      domain: url.host,
      // Pinned: a message signed for another chain or another site is refused, whatever it says.
      scheme: url.protocol.replace(':', ''),
    })
    if (!valid) return Response.json({ error: 'That signature does not match.' }, { status: 401 })

    const parsed = parseAddress(message)
    if (!parsed) return Response.json({ error: 'That message has no address.' }, { status: 400 })
    if (!messageIsForThisSite(message, url)) {
      return Response.json(
        { error: 'That message was made for another site or another network.' },
        { status: 401 },
      )
    }

    await ensureOwner(db(), parsed)

    // The nonce is spent. A new sign-in needs a new one.
    delete session.nonce
    session.address = parsed.toLowerCase()
    session.signedInAt = new Date().toISOString()
    await session.save()
    return Response.json({ address: session.address })
  } catch (e) {
    return Response.json({ error: errorText(e) }, { status: 400 })
  }
}

/** The address line of a Sign-In With Ethereum message, which is always its second line. */
function parseAddress(message: string): string | undefined {
  const line = message.split('\n')[1]?.trim()
  return line && /^0x[0-9a-fA-F]{40}$/.test(line) ? line : undefined
}

/** The URI and Chain ID lines of the message must name this site and Robinhood Chain. */
function messageIsForThisSite(message: string, url: URL): boolean {
  const lines = message.split('\n').map((l) => l.trim())
  const uri = lines.find((l) => l.startsWith('URI: '))?.slice(5)
  const chain = lines.find((l) => l.startsWith('Chain ID: '))?.slice(10)
  if (!uri || !chain) return false
  let host: string
  try {
    host = new URL(uri).host
  } catch {
    return false
  }
  return host === url.host && Number(chain) === CHAIN_ID
}

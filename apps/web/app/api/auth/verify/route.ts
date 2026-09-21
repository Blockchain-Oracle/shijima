import { makePublicClient } from '@desk/chain'
import { errorText } from '@desk/shared'
import { getSession } from '@/lib/session'

/**
 * Proves a wallet. The message must carry the nonce WE issued, this exact site, and this chain, so a signature
 * collected anywhere else cannot be used here. A smart-account wallet is supported too, which is why this
 * verifies through a chain client rather than recovering an address locally.
 */
export async function POST(request: Request) {
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
    })
    if (!valid) return Response.json({ error: 'That signature does not match.' }, { status: 401 })

    const parsed = parseAddress(message)
    if (!parsed) return Response.json({ error: 'That message has no address.' }, { status: 400 })

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

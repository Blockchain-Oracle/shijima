'use client'

import { webCopy } from '@desk/shared'
import type { Address } from 'viem'
import { robinhood } from 'viem/chains'
import { createSiweMessage } from 'viem/siwe'
import { useSignMessage } from 'wagmi'

/**
 * Signing in proves the wallet with one message: our nonce, this exact site and Robinhood Chain, checked by
 * `/api/auth/verify`. It costs nothing and moves nothing. Throws with a sentence a person can read.
 */
export function useSignIn() {
  const { signMessageAsync } = useSignMessage()
  return async (address: Address) => {
    const { nonce } = (await (await fetch('/api/auth/nonce')).json()) as { nonce: string }
    const message = createSiweMessage({
      address,
      chainId: robinhood.id,
      domain: window.location.host,
      // The server pins the scheme too (a message signed for http must not pass on https), so say it.
      scheme: window.location.protocol.replace(':', ''),
      nonce,
      uri: window.location.origin,
      version: '1',
      statement: 'Prove this wallet is yours. This costs nothing and moves nothing.',
    })
    const signature = await signMessageAsync({ message })
    const res = await fetch('/api/auth/verify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message, signature }),
    })
    if (!res.ok)
      throw new Error(((await res.json()) as { error?: string }).error ?? webCopy.account.signInFailed)
  }
}

/** A person saying no in their wallet is not a failure to explain; every wallet words it differently. */
export function isRejection(e: unknown): boolean {
  const text = e instanceof Error ? `${e.name} ${e.message}` : String(e)
  return /UserRejected|rejected|denied|cancel/i.test(text)
}

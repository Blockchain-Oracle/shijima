'use client'

import { deskAbi } from '@desk/chain'
import { useCallback, useEffect, useState } from 'react'
import {
  type Address,
  createPublicClient,
  createWalletClient,
  type Hex,
  http,
  type TransactionReceipt,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { robinhood } from 'viem/chains'
import { chainRpcUrl } from '@/lib/wagmi'
import { loadSessionKey, type StoredSessionKey } from './store'

export type SessionStatus = 'loading' | 'unsupported' | 'none' | 'live' | 'expired' | 'elsewhere'

export interface DeskSession {
  status: SessionStatus
  key: StoredSessionKey | null
  /** Seconds since 1970 when the on-chain grant ends. */
  expiresAt: number | null
  refresh: () => Promise<void>
}

export const browserClient = createPublicClient({ chain: robinhood, transport: http(chainRpcUrl) })

/**
 * This browser's standing with one desk's session key, from Masayume's `useKeySession`: the key it keeps, checked
 * against the grant the desk itself holds. Only a key the chain names, and whose grant has not ended, is live.
 * A v0 desk has no session keys at all.
 */
export function useDeskSession(owner: string, desk: Address, contractVersion: string): DeskSession {
  const [state, setState] = useState<Omit<DeskSession, 'refresh'>>({
    status: 'loading',
    key: null,
    expiresAt: null,
  })

  const refresh = useCallback(async () => {
    if (contractVersion === 'v0') {
      setState({ status: 'unsupported', key: null, expiresAt: null })
      return
    }
    const [key, onChain, expiresAt] = await Promise.all([
      loadSessionKey(owner, desk),
      browserClient.readContract({ address: desk, abi: deskAbi, functionName: 'session' }).catch(() => null),
      browserClient
        .readContract({ address: desk, abi: deskAbi, functionName: 'sessionExpiresAt' })
        .catch(() => null),
    ])
    const ends = expiresAt === null ? null : Number(expiresAt)
    const now = Math.floor(Date.now() / 1000)
    const granted =
      onChain && onChain !== '0x0000000000000000000000000000000000000000' ? (onChain as Address) : null
    const status: SessionStatus = !granted
      ? 'none'
      : key && key.address.toLowerCase() === granted.toLowerCase()
        ? ends !== null && ends > now
          ? 'live'
          : 'expired'
        : 'elsewhere'
    setState({ status, key, expiresAt: ends })
  }, [owner, desk, contractVersion])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { ...state, refresh }
}

/** Sends one prepared transaction from the session key, and waits for the chain's answer. */
export async function sendWithSessionKey(
  key: StoredSessionKey,
  to: Address,
  data: Hex,
): Promise<TransactionReceipt> {
  const wallet = createWalletClient({
    account: privateKeyToAccount(key.privateKey),
    chain: robinhood,
    transport: http(chainRpcUrl),
  })
  const hash = await wallet.sendTransaction({ to, data })
  return browserClient.waitForTransactionReceipt({ hash, timeout: 90_000 })
}

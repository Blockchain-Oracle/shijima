'use client'

import { useEffect, useState } from 'react'
import { type Address, createPublicClient, erc20Abi, http } from 'viem'
import { moneyChain } from '@/lib/money/chains'

const NATIVE = '0x0000000000000000000000000000000000000000'

/**
 * What the owner's wallet holds of one token on another chain, read in the browser from that chain's public RPC,
 * so a bridge screen can show "0.66 USDC on Base" and a Max. null until read, or when it cannot be.
 */
export function useOriginBalance(chainId: number, token: string | undefined, owner: string): bigint | null {
  const [balance, setBalance] = useState<bigint | null>(null)
  useEffect(() => {
    setBalance(null)
    const where = moneyChain(chainId)
    if (!where || !token) return
    let live = true
    const client = createPublicClient({ chain: where.chain, transport: http(where.rpc) })
    const read =
      token === NATIVE
        ? client.getBalance({ address: owner as Address })
        : client.readContract({
            address: token as Address,
            abi: erc20Abi,
            functionName: 'balanceOf',
            args: [owner as Address],
          })
    read.then((b) => live && setBalance(b)).catch(() => undefined)
    return () => {
      live = false
    }
  }, [chainId, token, owner])
  return balance
}

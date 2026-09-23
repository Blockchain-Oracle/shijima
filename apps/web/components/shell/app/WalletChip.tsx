'use client'

import { USDG } from '@desk/chain'
import { appCopy, short } from '@desk/shared'
import { Fuel } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { type Address, erc20Abi, formatUnits } from 'viem'
import { browserClient } from '@/features/session/useDeskSession'
import { cn } from '@/lib/utils'

/**
 * Gas for one typical owner signature: an add-money transfer is about 50k, creating an agent about 400k, a
 * withdraw about 100k. 150k is a fair middle, so "~40 signatures" is honest to within a factor of two.
 */
const TYPICAL_SIGNATURE_GAS = 150_000n
const REFRESH_MS = 30_000

interface Balances {
  usdg: bigint
  eth: bigint
  signatures: number
}

/**
 * The owner's own wallet at the top of the sidebar: its USDG, and a gas meter that counts signatures, not wei.
 * Read from the chain in the browser. The agent's trades never spend this ETH; Shijima's operator pays those.
 */
export function WalletChip({ address, collapsed }: { address: string; collapsed?: boolean }) {
  const [b, setB] = useState<Balances | null>(null)

  useEffect(() => {
    let stopped = false
    const read = async () => {
      try {
        const [usdg, eth, gasPrice] = await Promise.all([
          browserClient.readContract({
            address: USDG,
            abi: erc20Abi,
            functionName: 'balanceOf',
            args: [address as Address],
          }),
          browserClient.getBalance({ address: address as Address }),
          browserClient.getGasPrice(),
        ])
        const perSignature = gasPrice * TYPICAL_SIGNATURE_GAS
        const signatures = perSignature > 0n ? Number(eth / perSignature) : 0
        if (!stopped) setB({ usdg, eth, signatures })
      } catch {
        // A slow RPC leaves the last reading in place; the chip never shows a false zero.
      }
    }
    read()
    const timer = setInterval(read, REFRESH_MS)
    return () => {
      stopped = true
      clearInterval(timer)
    }
  }, [address])

  const c = appCopy.wallet
  const fill = b ? Math.min(1, b.signatures / 40) : 0
  const low = b !== null && b.signatures < 3

  if (collapsed) {
    return (
      <span className="wallet-chip wallet-chip--rail" title={`${short(address, 6, 4)} · ${c.gasTitle}`}>
        <span className="addr-dot" />
      </span>
    )
  }

  return (
    <section className="wallet-chip" aria-label={c.aria}>
      <div className="wallet-chip-top">
        <span className="addr-dot" />
        <span className="wallet-chip-addr" title={address}>
          {short(address, 6, 4)}
        </span>
        <span className="wallet-chip-usdg">
          {b ? `$${Number(formatUnits(b.usdg, 6)).toFixed(2)}` : c.reading}
          <small>{c.usdg}</small>
        </span>
      </div>
      <div className="wallet-chip-gas" title={c.gasTitle}>
        <Fuel aria-hidden="true" className="size-3.5" />
        <span className="wallet-chip-meter" aria-hidden="true">
          <span
            className={cn('wallet-chip-meter-fill', low && 'is-low')}
            style={{ width: `${fill * 100}%` }}
          />
        </span>
        <span className={cn('wallet-chip-gas-label', low && 'is-low')}>
          {b === null ? c.reading : b.eth === 0n ? c.gasNone : c.gasLeft(b.signatures)}
        </span>
        {low && (
          <Link href="/settings#wallet" className="wallet-chip-getgas">
            {c.getGas}
          </Link>
        )}
      </div>
    </section>
  )
}

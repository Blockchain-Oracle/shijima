'use client'

import { ETH_USD_FEED, readFeed, USDG } from '@desk/chain'
import { money, webCopy } from '@desk/shared'
import { Check, Copy } from 'lucide-react'
import { useEffect, useState } from 'react'
import { type Address, erc20Abi, formatEther, formatUnits } from 'viem'
import { ChainLogo } from '@/components/ui/chain-logo'
import { TokenLogo } from '@/components/ui/token-logo'
import { browserClient } from '@/features/session/useDeskSession'

const A = webCopy.account

interface Balances {
  usdg: bigint
  eth: bigint
  /** ETH in dollars from the chain's own Chainlink feed, or null when the feed did not answer. */
  ethUsd: number | null
}

/**
 * The top of the account menu: the full address with a copy button, then what the wallet holds on Robinhood
 * Chain (USDG, and ETH with its dollar value), read in the browser each time the menu opens.
 */
export function AccountBalances({ address }: { address: string }) {
  const [b, setB] = useState<Balances | null>(null)
  const [failed, setFailed] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let live = true
    const at = address as Address
    Promise.all([
      browserClient.readContract({ address: USDG, abi: erc20Abi, functionName: 'balanceOf', args: [at] }),
      browserClient.getBalance({ address: at }),
      readFeed(browserClient, ETH_USD_FEED)
        .then((f) => Number(f.price) / 1e8)
        .catch(() => null),
    ])
      .then(([usdg, eth, price]) => {
        if (live) setB({ usdg, eth, ethUsd: price === null ? null : Number(formatEther(eth)) * price })
      })
      .catch(() => live && setFailed(true))
    return () => {
      live = false
    }
  }, [address])

  const copy = () => {
    void navigator.clipboard?.writeText(address).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  const eth = b ? Number(formatEther(b.eth)) : null

  return (
    <div className="acct-top">
      <button type="button" className="acct-copy" onClick={copy} title={A.copyAddress}>
        <span className="acct-addr">{address}</span>
        <span className="acct-copy-icon" aria-hidden="true">
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        </span>
        <span className="sr-only">{copied ? A.copied : A.copyAddress}</span>
      </button>
      {copied && (
        <span className="acct-copied" role="status">
          {A.copied}
        </span>
      )}

      <div className="acct-chain">
        <ChainLogo chainId={4663} size={14} />
        <span>{A.onChain}</span>
      </div>
      <div className="acct-bal">
        <TokenLogo symbol="USDG" size={22} />
        <span className="acct-bal-name">USDG</span>
        <span className="acct-bal-val">
          {b ? money(formatUnits(b.usdg, 6)) : failed ? A.balanceUnknown : '…'}
        </span>
      </div>
      <div className="acct-bal">
        <TokenLogo symbol="ETH" size={22} />
        <span className="acct-bal-name">
          ETH <small>{A.forFees}</small>
        </span>
        <span className="acct-bal-val">
          {eth === null ? (failed ? A.balanceUnknown : '…') : eth.toFixed(eth > 0 && eth < 0.001 ? 6 : 4)}
          {b?.ethUsd != null && <small>{money(b.ethUsd.toFixed(2))}</small>}
        </span>
      </div>
    </div>
  )
}

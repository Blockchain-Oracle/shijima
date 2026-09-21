'use client'

import { USDG } from '@desk/chain'
import { controlsCopy } from '@desk/shared'
import { useState } from 'react'
import { type Address, erc20Abi, formatUnits, type Hex, parseUnits } from 'viem'
import { arbitrum, base, bsc, mainnet, robinhood } from 'viem/chains'
import { useAccount, useSendTransaction, useSwitchChain } from 'wagmi'
import { readContract, waitForTransactionReceipt } from 'wagmi/actions'
import { Button } from '@/components/ui/button'
import { browserClient } from '@/features/session/useDeskSession'
import { cn } from '@/lib/utils'
import { config } from '@/lib/wagmi'

const a = controlsCopy.addMoney
const RELAY = 'https://api.relay.link'
const NATIVE: Address = '0x0000000000000000000000000000000000000000'
/** Below this much ETH on Robinhood Chain the owner cannot pay for their own actions, so the top-up is offered. */
const LOW_ETH = parseUnits('0.0003', 18)
const GAS_TOP_UP_USDC = '1'

/** Where dollars can come from: USDC on four networks. Addresses from each issuer's own list. */
const ORIGINS = [
  { chain: base, name: 'Base', usdc: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6 },
  { chain: arbitrum, name: 'Arbitrum', usdc: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', decimals: 6 },
  { chain: mainnet, name: 'Ethereum', usdc: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6 },
  { chain: bsc, name: 'BNB Chain', usdc: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', decimals: 18 },
] as const
type Origin = (typeof ORIGINS)[number]

interface Quote {
  steps: {
    id: string
    requestId: string
    items: { data: { to: Address; data: Hex; value: string; chainId: number } }[]
  }[]
  details: {
    currencyIn: { amountFormatted: string }
    currencyOut: { amountFormatted: string }
    totalImpact?: { usd: string; percent: string }
    timeEstimate?: number
  }
}

async function relay<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${RELAY}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { 'content-type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const json = (await res.json()) as T & { message?: string }
  if (!res.ok) throw new Error(json.message ?? `Relay ${res.status}`)
  return json
}

const quoteFor = (o: Origin, amount: bigint, from: Address, to: Address, currency: Address) =>
  relay<Quote>('/quote', {
    user: from,
    recipient: to,
    originChainId: o.chain.id,
    destinationChainId: robinhood.id,
    originCurrency: o.usdc,
    destinationCurrency: currency,
    amount: amount.toString(),
    tradeType: 'EXACT_INPUT',
  })

/**
 * "Bring dollars from another network" (design brief 8.5), through Relay: USDC on Base, Arbitrum, Ethereum or BNB
 * Chain arrives in the desk as USDG, usually in seconds. It goes straight to the desk's own address, never through
 * us. Before anything is signed the owner sees what they send, what the desk receives, the cost and the time.
 * The desk never receives ETH, so the optional gas top-up goes to the owner's own wallet as a separate transfer.
 */
export function BridgeIn({ desk, owner }: { desk: Address; owner: Address }) {
  const { address, chainId } = useAccount()
  const { switchChainAsync } = useSwitchChain()
  const { sendTransactionAsync } = useSendTransaction()
  const [origin, setOrigin] = useState<Origin>(ORIGINS[0])
  const [amount, setAmount] = useState('')
  const [gas, setGas] = useState(false)
  const [lowEth, setLowEth] = useState<boolean | null>(null)
  const [held, setHeld] = useState<string | null>(null)
  const [quote, setQuote] = useState<Quote | null>(null)
  const [busy, setBusy] = useState(false)
  const [line, setLine] = useState<{ text: string; tone: 'muted' | 'ok' | 'bad' } | null>(null)
  const rightWallet = address?.toLowerCase() === owner.toLowerCase()

  const ask = async () => {
    setBusy(true)
    setLine(null)
    setQuote(null)
    try {
      const units = parseUnits(amount || '0', origin.decimals)
      if (units <= 0n) throw new Error('Enter an amount.')
      const [q, balance, eth] = await Promise.all([
        quoteFor(origin, units, owner, desk, USDG),
        readContract(config, {
          address: origin.usdc,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [owner],
          chainId: origin.chain.id,
        }).catch(() => null),
        lowEth === null ? browserClient.getBalance({ address: owner }) : Promise.resolve(null),
      ])
      if (eth !== null) {
        setLowEth(eth < LOW_ETH)
        setGas(eth < LOW_ETH)
      }
      setHeld(balance === null ? null : Number(formatUnits(balance, origin.decimals)).toFixed(2))
      setQuote(q)
    } catch (e) {
      setLine({ text: e instanceof Error ? e.message : a.progress.failed, tone: 'bad' })
    } finally {
      setBusy(false)
    }
  }

  /** Runs every step of a quote on the origin network, then waits for Relay to say it arrived. */
  const run = async (q: Quote, count: { n: number; of: number }) => {
    for (const step of q.steps) {
      for (const item of step.items) {
        if (item.data.chainId !== origin.chain.id) throw new Error('Relay asked for a different network.')
        count.n += 1
        setLine({ text: a.progress.signing(count.n, count.of), tone: 'muted' })
        const hash = await sendTransactionAsync({
          to: item.data.to,
          data: item.data.data,
          value: BigInt(item.data.value || '0'),
          chainId: origin.chain.id,
        })
        await waitForTransactionReceipt(config, { hash, chainId: origin.chain.id, timeout: 180_000 })
      }
    }
    setLine({ text: a.progress.waiting, tone: 'muted' })
    const requestId = q.steps.at(-1)?.requestId
    for (let i = 0; requestId && i < 90; i++) {
      const s = await relay<{ status: string }>(`/intents/status/v3?requestId=${requestId}`)
      if (s.status === 'success') return
      if (s.status === 'failure' || s.status === 'refund') throw new Error(a.progress.failed)
      await new Promise((r) => setTimeout(r, 2000))
    }
  }

  const send = async () => {
    if (!quote) return
    setBusy(true)
    try {
      if (chainId !== origin.chain.id) {
        setLine({ text: a.progress.switching(origin.name), tone: 'muted' })
        await switchChainAsync({ chainId: origin.chain.id })
      }
      const topUp = gas
        ? await quoteFor(origin, parseUnits(GAS_TOP_UP_USDC, origin.decimals), owner, owner, NATIVE)
        : null
      const items = (q: Quote | null) => q?.steps.reduce((n, s) => n + s.items.length, 0) ?? 0
      const count = { n: 0, of: items(quote) + items(topUp) }
      await run(quote, count)
      if (topUp) await run(topUp, count)
      setLine({ text: a.progress.back, tone: 'muted' })
      await switchChainAsync({ chainId: robinhood.id }).catch(() => undefined)
      setLine({
        text: a.progress.done(`$${Number(quote.details.currencyOut.amountFormatted).toFixed(2)}`),
        tone: 'ok',
      })
      setQuote(null)
    } catch (e) {
      const cancelled = e instanceof Error && /reject|denied/i.test(e.message)
      setLine({ text: cancelled ? a.progress.cancelled : a.progress.failed, tone: 'bad' })
    } finally {
      setBusy(false)
    }
  }

  const impact = quote?.details.totalImpact
  // The wallet on the origin network holds less than it is about to send.
  const short = held !== null && Number(held) < Number(amount)
  return (
    <div className="desk-path">
      <strong className="type-body-strong text-ink">{a.elsewhere}</strong>
      <span className="type-caption text-ink-muted">{a.elsewhereNote}</span>
      <div className="desk-choice">
        {ORIGINS.map((o) => (
          <button
            key={o.chain.id}
            type="button"
            aria-pressed={origin.chain.id === o.chain.id}
            className={cn('desk-choice-option', origin.chain.id === o.chain.id && 'active')}
            onClick={() => {
              setOrigin(o)
              setQuote(null)
            }}
          >
            {o.name}
          </button>
        ))}
      </div>
      <label className="desk-field">
        <span className="type-label-micro text-ink-muted">{a.usdcAmount}</span>
        <span className="desk-input">
          <input
            inputMode="decimal"
            placeholder="25.00"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value.replace(/[^0-9.]/g, ''))
              setQuote(null)
            }}
          />
          <span aria-hidden>USDC</span>
        </span>
      </label>
      {quote ? (
        <>
          <dl className="desk-receipt">
            <dt>{a.youSend}</dt>
            <dd>
              {quote.details.currencyIn.amountFormatted} USDC on {origin.name}
            </dd>
            <dt>{a.youReceive}</dt>
            <dd className="text-ink">${Number(quote.details.currencyOut.amountFormatted).toFixed(2)} USDG</dd>
            {impact && (
              <>
                <dt>{a.cost}</dt>
                <dd>
                  ${Math.abs(Number(impact.usd)).toFixed(2)} ({Math.abs(Number(impact.percent)).toFixed(2)}%)
                </dd>
              </>
            )}
            <dt>{a.takes}</dt>
            <dd>{a.seconds(quote.details.timeEstimate ?? 30)}</dd>
          </dl>
          {held !== null && (
            <p className={cn('type-caption', short ? 'text-warning' : 'text-ink-muted')}>
              {a.held(held, origin.name)}
            </p>
          )}
          {lowEth && (
            <label className="flex items-start gap-2 type-caption text-ink-secondary">
              <input type="checkbox" checked={gas} onChange={(e) => setGas(e.target.checked)} />
              <span>{a.gas}</span>
            </label>
          )}
          <Button onClick={send} disabled={busy || !rightWallet || short}>
            {a.send(origin.name)}
          </Button>
        </>
      ) : (
        <Button variant="secondary" onClick={ask} disabled={busy || !amount}>
          {busy ? a.quoting : a.quote}
        </Button>
      )}
      {line && (
        <p
          className={cn(
            'type-caption',
            line.tone === 'ok' ? 'text-profit' : line.tone === 'bad' ? 'text-loss' : 'text-ink-muted',
          )}
          role="status"
        >
          {line.text}
        </p>
      )}
    </div>
  )
}

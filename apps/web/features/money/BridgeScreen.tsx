'use client'

import { moneyCopy } from '@desk/shared'
import { ArrowLeftRight, Fuel } from 'lucide-react'
import type { Route } from 'next'
import Link from 'next/link'
import { type ReactNode, useMemo, useState } from 'react'
import { formatUnits } from 'viem'
import { BoundaryBadge, Button, Callout, FlowCard, Screen, ScreenTitle, Segmented } from '@/components/kit'
import {
  AssetPicker,
  AssetPill,
  dollars,
  readable,
  TicketAmount,
  TicketArrow,
  TicketBox,
  TicketQuoted,
} from '@/components/kit/ticket'
import { CHAIN_LOGOS, ChainLogo } from '@/components/ui/chain-logo'
import type { FundChain } from './FundScreen'
import { MoveFlow } from './MoveFlow'
import { toRaw } from './SendScreen'

const c = moneyCopy.bridge
const t = moneyCopy.ticket
const ROBINHOOD = 4663
const USDG_DECIMALS = 6

type Dir = 'out' | 'in' | 'gas'

/** How a bridge moves, beside the ticket: the three steps, and the chains Relay reaches from here. */
function HowItMoves() {
  return (
    <div className="kit-summary">
      <strong style={{ fontSize: 13.5 }}>{c.howTitle}</strong>
      <ol
        style={{ margin: '10px 0 12px', paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}
      >
        {c.how.map((line) => (
          <li key={line} style={{ fontSize: 12.5, color: 'var(--tx2)', lineHeight: 1.5 }}>
            {line}
          </li>
        ))}
      </ol>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {[4663, 8453, 42161, 1, 56].map((id) => (
          <span key={id} className="kit-chain-chip">
            <ChainLogo chainId={id} size={16} /> {CHAIN_LOGOS[id]?.name}
          </span>
        ))}
      </div>
    </div>
  )
}

/**
 * Bridge (W6), after the reference wallet's two-panel bridge and 21st's Multi-chain Swap (16251): the ticket on the
 * left, the route and Review on the right. Out sends USDG from your wallet to your same wallet on Base, Arbitrum,
 * Ethereum or BNB Chain as USDC or the chain's coin. In opens Fund, since money coming in belongs to an agent. Gas
 * swaps a dollar of USDG to ETH, or brings ETH from another chain when there is nothing here to pay for a swap.
 */
export function BridgeScreen({
  owner,
  initialDir,
  usdgRaw,
  eth,
  outChains,
  gasChains,
}: {
  owner: string
  initialDir: Dir
  usdgRaw: string
  eth: string
  outChains: FundChain[]
  gasChains: FundChain[]
}) {
  const [dir, setDir] = useState<Dir>(initialDir)
  const tabs = (
    <Segmented
      label={c.direction}
      fullWidth
      options={[
        { value: 'out', label: c.dirs.out },
        { value: 'in', label: c.dirs.in },
        { value: 'gas', label: c.dirs.gas },
      ]}
      value={dir}
      onChange={(v) => setDir(v as Dir)}
    />
  )
  return (
    <Screen width={1100} gap={8}>
      <ScreenTitle title={c.title} sub={c.sub} />
      {dir === 'out' ? (
        <BridgeOut owner={owner} usdgRaw={usdgRaw} chains={outChains} tabs={tabs} />
      ) : dir === 'gas' ? (
        <GetGas owner={owner} eth={eth} usdgRaw={usdgRaw} chains={gasChains} tabs={tabs} />
      ) : (
        <div className="kit-money">
          <FlowCard
            icon={<ArrowLeftRight size={16} />}
            title={c.inTitle}
            badge={<BoundaryBadge kind="agent" />}
          >
            {tabs}
            <p style={{ margin: 0, fontSize: 13.5, color: 'var(--tx2)', lineHeight: 1.55 }}>{c.inBody}</p>
            <Link href={'/fund?from=chain' as Route} style={{ textDecoration: 'none' }}>
              <Button fullWidth>{c.inCta} →</Button>
            </Link>
          </FlowCard>
          <div className="kit-money-side">
            <HowItMoves />
          </div>
        </div>
      )}
    </Screen>
  )
}

function BridgeOut({
  owner,
  usdgRaw,
  chains,
  tabs,
}: {
  owner: string
  usdgRaw: string
  chains: FundChain[]
  tabs: ReactNode
}) {
  const first = chains[0]
  const [dest, setDest] = useState(first?.tokens[0] ? `${first.id}:${first.tokens[0].address}` : '')
  const [amount, setAmount] = useState('')
  const [picking, setPicking] = useState(false)
  const [chainId, tokenAddress] = dest.split(':')
  const chain = chains.find((ch) => ch.id === Number(chainId))
  const token = chain?.tokens.find((tk) => tk.address === tokenAddress)
  const held = formatUnits(BigInt(usdgRaw), USDG_DECIMALS)

  const { input, invalid } = useMemo(() => {
    const raw = toRaw(amount, USDG_DECIMALS)
    if (raw === null || !chain || !token) return { input: null, invalid: null }
    if (raw > BigInt(usdgRaw)) return { input: null, invalid: moneyCopy.fund.moreThanHeld('USDG') }
    return {
      input: {
        kind: 'bridge_out' as const,
        amountRaw: raw.toString(),
        to: { chainId: chain.id, token: token.address },
      },
      invalid: null,
    }
  }, [amount, chain, token, usdgRaw])

  return (
    <MoveFlow
      title={c.outTitle}
      icon={<ArrowLeftRight size={16} />}
      badge={<BoundaryBadge kind="wallet" />}
      owner={owner}
      input={input}
      invalid={invalid}
      reviewLabel={c.review}
      doneTitle={c.done}
      route={{
        from: { chainId: ROBINHOOD, label: 'Robinhood Chain' },
        to: { chainId: chain?.id ?? 8453, label: chain?.name ?? '' },
      }}
      aside={<HowItMoves />}
      ticket={(q) => (
        <>
          {tabs}
          <TicketBox
            label={t.youSend}
            side={
              <>
                {t.held(`${readable(usdgRaw, USDG_DECIMALS)} USDG`)}
                {Number(held) > 0 ? (
                  <button type="button" onClick={() => setAmount(held)}>
                    {t.max}
                  </button>
                ) : null}
              </>
            }
            foot={amount && Number(amount) > 0 ? t.worth(dollars(Number(amount))) : ' '}
          >
            <TicketAmount
              value={amount}
              onChange={setAmount}
              label="USDG amount"
              invalid={Boolean(invalid && amount)}
            />
            <AssetPill symbol="USDG" chainId={ROBINHOOD} />
          </TicketBox>
          <TicketArrow />
          <TicketBox
            label={t.youReceive}
            foot={
              q.quote
                ? t.worth(dollars(Number(q.quote.usdgValue) / 1e6 - Number(q.quote.feeUsdg) / 1e6))
                : c.toYou
            }
          >
            <TicketQuoted
              text={q.quote ? readable(q.quote.receive.amountRaw, q.quote.receive.decimals) : null}
              loading={q.loading}
            />
            {chain && token ? (
              <AssetPill symbol={token.symbol} chainId={chain.id} onClick={() => setPicking(true)} />
            ) : null}
          </TicketBox>
          {Number(held) === 0 ? <Callout tone="wallet">{c.noUsdg}</Callout> : null}
          <AssetPicker
            open={picking}
            onClose={() => setPicking(false)}
            title={t.pickChainToken}
            selected={dest}
            options={chains.flatMap((ch) =>
              ch.tokens.map((tk) => ({
                key: `${ch.id}:${tk.address}`,
                symbol: tk.symbol,
                name: tk.name,
                chainId: ch.id,
              })),
            )}
            onPick={(key) => setDest(key)}
          />
        </>
      )}
    />
  )
}

/**
 * Get gas: with a little ETH and a dollar of USDG, $1 of USDG swapped to ETH in your wallet; otherwise ETH comes
 * from another chain through Relay.
 */
function GetGas({
  owner,
  eth,
  usdgRaw,
  chains,
  tabs,
}: {
  owner: string
  eth: string
  usdgRaw: string
  chains: FundChain[]
  tabs: ReactNode
}) {
  // The swap needs a dollar of USDG and a little ETH to pay for itself; without both, gas comes over Relay.
  const canSwap = Number(eth) > 0 && BigInt(usdgRaw) >= 1_000_000n
  const [chainId, setChainId] = useState(chains[0]?.id ?? 8453)
  const [amount, setAmount] = useState(canSwap ? '1' : '0.0005')
  const [picking, setPicking] = useState(false)
  const chain = chains.find((ch) => ch.id === chainId)
  const native = chain?.tokens[0]

  const input = useMemo(() => {
    if (canSwap) {
      const raw = toRaw(amount, USDG_DECIMALS)
      return raw === null ? null : { kind: 'get_gas' as const, amountUsdg: raw.toString() }
    }
    const raw = native ? toRaw(amount, native.decimals) : null
    if (raw === null || !native) return null
    return { kind: 'get_gas' as const, origin: { chainId, token: native.address, amountRaw: raw.toString() } }
  }, [canSwap, native, amount, chainId])

  return (
    <MoveFlow
      title={c.gasTitle}
      icon={<Fuel size={16} />}
      owner={owner}
      input={input}
      reviewLabel={c.gasReview}
      doneTitle={c.gasDone}
      route={{
        from: canSwap
          ? { chainId: ROBINHOOD, label: 'USDG' }
          : { chainId, label: CHAIN_LOGOS[chainId]?.name ?? '' },
        to: { chainId: ROBINHOOD, label: 'ETH' },
      }}
      aside={
        <div className="kit-summary">
          <p style={{ margin: 0, fontSize: 12.5, color: 'var(--tx2)', lineHeight: 1.55 }}>
            {c.gasBody} {c.gasHave(Number(eth).toLocaleString('en-US', { maximumFractionDigits: 6 }))}
          </p>
          <Link
            href={'/wallet#gift' as Route}
            style={{
              display: 'inline-block',
              marginTop: 10,
              fontSize: 12.5,
              color: 'var(--ac2)',
              fontWeight: 600,
            }}
          >
            {c.gift}
          </Link>
        </div>
      }
      ticket={(q) => (
        <>
          {tabs}
          <TicketBox
            label={t.youPay}
            foot={canSwap ? c.gasSwapNote : c.gasFromHint}
            side={canSwap ? t.held(`${readable(usdgRaw, USDG_DECIMALS)} USDG`) : undefined}
          >
            <TicketAmount value={amount} onChange={setAmount} label="Amount" />
            {canSwap ? (
              <AssetPill symbol="USDG" chainId={ROBINHOOD} />
            ) : (
              <AssetPill
                symbol={native?.symbol ?? 'ETH'}
                chainId={chainId}
                onClick={() => setPicking(true)}
              />
            )}
          </TicketBox>
          <TicketArrow />
          <TicketBox
            label={t.youGet}
            foot={q.quote ? t.worth(dollars(Number(q.quote.usdgValue) / 1e6)) : ' '}
          >
            <TicketQuoted
              text={q.quote ? readable(q.quote.receive.amountRaw, q.quote.receive.decimals) : null}
              loading={q.loading}
            />
            <AssetPill symbol="ETH" chainId={ROBINHOOD} />
          </TicketBox>
          <AssetPicker
            open={picking}
            onClose={() => setPicking(false)}
            title={t.pickChainToken}
            selected={String(chainId)}
            options={chains.map((ch) => ({
              key: String(ch.id),
              symbol: ch.tokens[0]?.symbol ?? 'ETH',
              name: ch.tokens[0]?.name ?? '',
              chainId: ch.id,
            }))}
            onPick={(key) => {
              setChainId(Number(key))
              setAmount(Number(key) === 56 ? '0.002' : '0.0005')
            }}
          />
        </>
      )}
    />
  )
}

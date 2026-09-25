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
  AssetToggle,
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
import { useOriginBalance } from './useOriginBalance'

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
 * left, the route and Review on the right. In brings any token from Base, Arbitrum, Ethereum or BNB Chain into your
 * own wallet here, as USDG or ETH, with no agent needed. Out sends USDG back out to your same wallet there. Gas
 * swaps USDG you hold here to ETH, or brings ETH from another network in any token.
 */
export function BridgeScreen({
  owner,
  initialDir,
  usdgRaw,
  eth,
  outChains,
  inChains,
}: {
  owner: string
  initialDir: Dir
  usdgRaw: string
  eth: string
  outChains: FundChain[]
  /** Every token Relay takes on each other chain, for money in and for gas. */
  inChains: FundChain[]
}) {
  const [dir, setDir] = useState<Dir>(initialDir)
  const tabs = (
    <Segmented
      label={c.direction}
      fullWidth
      options={[
        { value: 'in', label: c.dirs.in },
        { value: 'out', label: c.dirs.out },
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
        <GetGas owner={owner} eth={eth} usdgRaw={usdgRaw} chains={inChains} tabs={tabs} />
      ) : (
        <FromChain owner={owner} chains={inChains} tabs={tabs} receive="usdg" choose />
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
 * Get gas: swap a dollar of USDG you already hold here into ETH, or bring ETH from another network in any token
 * you hold there. The choice is yours; the swap is only offered when there is USDG and a little ETH to pay for it.
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
  const canSwap = Number(eth) > 0 && BigInt(usdgRaw) >= 1_000_000n
  const [source, setSource] = useState<'here' | 'chain'>(canSwap ? 'here' : 'chain')
  const [amount, setAmount] = useState('1')
  const sourceTabs = (
    <>
      {tabs}
      {canSwap && (
        <Segmented
          label={c.gasSource}
          fullWidth
          options={[
            { value: 'here', label: c.gasSourceHere },
            { value: 'chain', label: c.gasSourceChain },
          ]}
          value={source}
          onChange={(v) => setSource(v as 'here' | 'chain')}
        />
      )}
    </>
  )
  if (source === 'chain') return <FromChain owner={owner} chains={chains} tabs={sourceTabs} receive="eth" />

  const raw = toRaw(amount, USDG_DECIMALS)
  const input = raw === null ? null : { kind: 'get_gas' as const, amountUsdg: raw.toString() }
  return (
    <MoveFlow
      title={c.gasTitle}
      icon={<Fuel size={16} />}
      owner={owner}
      input={input}
      reviewLabel={c.gasReview}
      doneTitle={c.gasDone}
      route={{ from: { chainId: ROBINHOOD, label: 'USDG' }, to: { chainId: ROBINHOOD, label: 'ETH' } }}
      aside={
        <div className="kit-summary">
          <p style={{ margin: 0, fontSize: 12.5, color: 'var(--tx2)', lineHeight: 1.55 }}>
            {c.gasBody} {c.gasHave(Number(eth).toLocaleString('en-US', { maximumFractionDigits: 6 }))}
          </p>
        </div>
      }
      ticket={(q) => (
        <>
          {sourceTabs}
          <TicketBox
            label={t.youPay}
            foot={c.gasSwapNote}
            side={t.held(`${readable(usdgRaw, USDG_DECIMALS)} USDG`)}
          >
            <TicketAmount value={amount} onChange={setAmount} label="Amount" />
            <AssetPill symbol="USDG" chainId={ROBINHOOD} />
          </TicketBox>
          <TicketArrow />
          <TicketBox
            label={t.youGet}
            foot={q.quote ? t.worth(dollars(Number(q.quote.usdgValue) / 1e6)) : ' '}
          >
            <TicketQuoted
              text={q.quote ? readable(q.quote.receive.amountRaw, q.quote.receive.decimals) : null}
              loading={q.loading}
            />
            <AssetPill symbol="ETH" chainId={ROBINHOOD} />
          </TicketBox>
        </>
      )}
    />
  )
}

/**
 * Money from another network into the owner's own wallet on Robinhood Chain, through Relay: any token Relay takes
 * on Base, Arbitrum, Ethereum or BNB Chain, with what the wallet holds of it there and a Max. It arrives as USDG
 * (to spend, or to fund an agent later) or as ETH (for fees). No agent is needed.
 */
function FromChain({
  owner,
  chains,
  tabs,
  receive: fixed,
  choose = false,
}: {
  owner: string
  chains: FundChain[]
  tabs: ReactNode
  receive: 'usdg' | 'eth'
  /** Let the owner pick what arrives; otherwise it is always `receive`. */
  choose?: boolean
}) {
  const firstChain = chains[0]
  // USDC first where the chain has it: it is what most people hold, and a dollar in is a dollar out.
  const firstToken = firstChain?.tokens.find((tk) => tk.symbol === 'USDC') ?? firstChain?.tokens[0]
  const [pick, setPick] = useState(firstChain && firstToken ? `${firstChain.id}:${firstToken.address}` : '')
  const [receive, setReceive] = useState<'usdg' | 'eth'>(fixed)
  const [amount, setAmount] = useState('')
  const [picking, setPicking] = useState(false)
  const [chainId, tokenAddress] = pick.split(':')
  const chain = chains.find((ch) => ch.id === Number(chainId))
  const token = chain?.tokens.find((tk) => tk.address === tokenAddress)
  const held = useOriginBalance(chain?.id ?? 0, token?.address, owner)
  const heldText = held !== null && token ? formatUnits(held, token.decimals) : null

  const { input, invalid } = useMemo(() => {
    const raw = token ? toRaw(amount, token.decimals) : null
    if (raw === null || !chain || !token) return { input: null, invalid: null }
    if (held !== null && raw > held)
      return { input: null, invalid: moneyCopy.fund.moreThanHeld(token.symbol) }
    return {
      input: {
        kind: 'get_gas' as const,
        origin: { chainId: chain.id, token: token.address, amountRaw: raw.toString() },
        receive,
      },
      invalid: null,
    }
  }, [amount, chain, token, held, receive])

  const out = receive === 'usdg' ? 'USDG' : 'ETH'
  return (
    <MoveFlow
      title={receive === 'usdg' ? c.inTitle : c.gasTitle}
      icon={receive === 'usdg' ? <ArrowLeftRight size={16} /> : <Fuel size={16} />}
      badge={<BoundaryBadge kind="wallet" />}
      owner={owner}
      input={input}
      invalid={invalid}
      reviewLabel={c.review}
      doneTitle={receive === 'usdg' ? c.done : c.gasDone}
      route={{
        from: { chainId: chain?.id ?? 8453, label: chain?.name ?? '' },
        to: { chainId: ROBINHOOD, label: 'Robinhood Chain' },
      }}
      aside={
        <div className="kit-summary">
          <p style={{ margin: 0, fontSize: 12.5, color: 'var(--tx2)', lineHeight: 1.55 }}>{c.inWallet}</p>
          {receive === 'usdg' && (
            <Link
              href={'/fund?from=chain' as Route}
              style={{
                display: 'inline-block',
                marginTop: 10,
                fontSize: 12.5,
                color: 'var(--ac2)',
                fontWeight: 600,
              }}
            >
              {c.fundInstead} →
            </Link>
          )}
        </div>
      }
      ticket={(q) => (
        <>
          {tabs}
          <TicketBox
            label={t.youSend}
            side={
              heldText !== null && token ? (
                <>
                  {c.heldThere(
                    `${readable(held?.toString() ?? '0', token.decimals)} ${token.symbol}`,
                    chain?.name ?? '',
                  )}
                  {held !== null && held > 0n ? (
                    <button type="button" onClick={() => setAmount(heldText)}>
                      {t.max}
                    </button>
                  ) : null}
                </>
              ) : undefined
            }
            foot=" "
          >
            <TicketAmount
              value={amount}
              onChange={setAmount}
              label="Amount"
              invalid={Boolean(invalid && amount)}
            />
            {chain && token ? (
              <AssetPill symbol={token.symbol} chainId={chain.id} onClick={() => setPicking(true)} />
            ) : null}
          </TicketBox>
          <TicketArrow />
          <TicketBox
            label={t.youReceive}
            foot={`${receive === 'usdg' ? c.asUsdg : c.asEth}${q.quote ? ` · ${t.worth(dollars(Number(q.quote.usdgValue) / 1e6))}` : ''}`}
          >
            <TicketQuoted
              text={q.quote ? readable(q.quote.receive.amountRaw, q.quote.receive.decimals) : null}
              loading={q.loading}
            />
            {choose ? (
              <AssetToggle
                left="USDG"
                right="ETH"
                value={out}
                chainId={ROBINHOOD}
                label={c.arrivesAs}
                onChange={(v) => setReceive(v === 'ETH' ? 'eth' : 'usdg')}
              />
            ) : (
              <AssetPill symbol={out} chainId={ROBINHOOD} />
            )}
          </TicketBox>
          <AssetPicker
            open={picking}
            onClose={() => setPicking(false)}
            title={t.pickChainToken}
            selected={pick}
            options={chains.flatMap((ch) =>
              ch.tokens.map((tk) => ({
                key: `${ch.id}:${tk.address}`,
                symbol: tk.symbol,
                name: tk.name,
                chainId: ch.id,
              })),
            )}
            onPick={(key) => {
              setPick(key)
              setAmount('')
            }}
          />
        </>
      )}
    />
  )
}

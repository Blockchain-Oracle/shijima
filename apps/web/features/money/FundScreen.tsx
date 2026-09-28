'use client'

import { moneyCopy } from '@desk/shared'
import { ArrowDownToLine, Copy } from 'lucide-react'
import type { Route } from 'next'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { type Address, formatUnits } from 'viem'
import {
  BoundaryBadge,
  buttonStyle,
  Callout,
  FlowCard,
  QrCard,
  Screen,
  ScreenTitle,
  Segmented,
} from '@/components/kit'
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
import { hasCryptoLogo, TokenLogo } from '@/components/ui/token-logo'
import { MoneyEmpty, NetworksCard, WalletList } from './MoneyParts'
import { MoveFlow } from './MoveFlow'
import { toRaw, worthOf } from './SendScreen'

export interface FundAgent {
  id: string
  slug: string
  name: string
  address: string
}

export interface FundAsset {
  symbol: string
  name: string
  token: Address
  decimals: number
  /** Raw units held, as a decimal string. */
  balanceRaw: string
  valueUsd: number | null
  kind: 'usdg' | 'eth' | 'stock'
}

export interface FundChain {
  id: number
  name: string
  tokens: { address: Address; symbol: string; name: string; decimals: number }[]
}

const ROBINHOOD = 4663
const c = moneyCopy.fund
const t = moneyCopy.ticket
const PRESETS = ['5', '20', '100']
/** The tokens offered per other chain: the chain's own coin and its featured tokens come first from Relay. */
const PER_CHAIN = 8

/**
 * Fund an agent (W4) on the money ticket. You pay any token, from your own wallet on Robinhood Chain (USDG straight
 * in, ETH swapped, a Stock Token as it is or swapped) or from another chain through Relay; your agent gets USDG,
 * or the stock itself, and the summary beside it says what lands, the least it can be, the cost and the time.
 * "From anywhere" shows the agent's address as a QR code instead.
 */
export function FundScreen({
  owner,
  agents,
  assets,
  chains,
  initialAgent,
  initialSource = 'wallet',
}: {
  owner: string
  agents: FundAgent[]
  assets: FundAsset[]
  chains: FundChain[]
  initialAgent: string | null
  initialSource?: 'wallet' | 'chain' | 'anywhere'
}) {
  const [agentKey, setAgentKey] = useState(
    agents.find((a) => a.slug === initialAgent || a.id === initialAgent)?.id ?? agents[0]?.id ?? '',
  )
  const [source, setSource] = useState<'wallet' | 'chain' | 'anywhere'>(
    initialSource === 'wallet' && assets.length === 0 ? 'chain' : initialSource,
  )
  const [assetToken, setAssetToken] = useState<string>(assets[0]?.token ?? '')
  const [origin, setOrigin] = useState<string>(
    chains[0]?.tokens[0] ? `${chains[0].id}:${chains[0].tokens[0].address}` : '',
  )
  const [amount, setAmount] = useState('')
  const [picking, setPicking] = useState<'asset' | 'agent' | null>(null)
  const agent = agents.find((a) => a.id === agentKey)
  const asset = assets.find((a) => a.token === assetToken)
  const [originChainId, originAddress] = origin.split(':')
  const originChain = chains.find((ch) => ch.id === Number(originChainId))
  const originToken = originChain?.tokens.find((tk) => tk.address === originAddress)

  const { input, invalid } = useMemo(() => {
    if (!agent) return { input: null, invalid: null }
    if (source === 'wallet') {
      if (!asset) return { input: null, invalid: null }
      const raw = toRaw(amount, asset.decimals)
      if (raw === null) return { input: null, invalid: null }
      if (raw > BigInt(asset.balanceRaw)) return { input: null, invalid: c.moreThanHeld(asset.symbol) }
      return {
        input: {
          kind: 'fund' as const,
          deskId: agent.id,
          source: { chainId: ROBINHOOD, token: asset.token, amountRaw: raw.toString() },
        },
        invalid: null,
      }
    }
    if (source === 'chain' && originChain && originToken) {
      const raw = toRaw(amount, originToken.decimals)
      if (raw === null) return { input: null, invalid: null }
      return {
        input: {
          kind: 'fund' as const,
          deskId: agent.id,
          source: { chainId: originChain.id, token: originToken.address, amountRaw: raw.toString() },
        },
        invalid: null,
      }
    }
    return { input: null, invalid: null }
  }, [agent, source, asset, amount, originChain, originToken])

  if (agents.length === 0 || !agent) {
    return (
      <Screen width={1100}>
        <ScreenTitle title={c.title} sub={c.sub} />
        <MoneyEmpty
          marks={[{ token: 'USDG' }, { chain: 4663 }, { token: 'NVDA' }]}
          title={c.noAgentTitle}
          body={c.noAgentBody}
        >
          <Link href={'/agents/new' as Route} style={buttonStyle('primary')}>
            {c.create}
          </Link>
        </MoneyEmpty>
      </Screen>
    )
  }

  const paying =
    source === 'wallet' && asset
      ? { symbol: asset.symbol, chainId: ROBINHOOD }
      : originChain && originToken
        ? { symbol: originToken.symbol, chainId: originChain.id }
        : null
  const stable = paying !== null && /^(USDG|USDC|USDT|DAI)$/i.test(paying.symbol)
  const sourceTabs = (
    <Segmented
      label={c.from}
      fullWidth
      options={[
        { value: 'wallet', label: c.sources.wallet },
        { value: 'chain', label: c.sources.chain },
        { value: 'anywhere', label: c.sources.anywhere },
      ]}
      value={source}
      onChange={(v) => {
        setSource(v as typeof source)
        setAmount('')
      }}
    />
  )
  const agentPill = (receiving: string) => (
    <AssetPill
      symbol={receiving}
      chainId={ROBINHOOD}
      label={agent.name}
      {...(agents.length > 1 ? { onClick: () => setPicking('agent') } : {})}
    />
  )
  const agentPicker = (
    <AssetPicker
      open={picking === 'agent'}
      onClose={() => setPicking(null)}
      title={t.pickAgent}
      selected={agent.id}
      options={agents.map((a) => ({
        key: a.id,
        symbol: 'USDG',
        name: a.name,
        chainId: ROBINHOOD,
        note: a.name,
      }))}
      onPick={setAgentKey}
    />
  )

  if (source === 'anywhere') {
    return (
      <Screen width={1100} gap={8}>
        <ScreenTitle title={c.title} sub={c.sub} />
        <div className="kit-money">
          <FlowCard
            icon={<ArrowDownToLine size={16} />}
            title={c.cardTitle(agent.name)}
            badge={<BoundaryBadge kind="agent" label={agent.name.toUpperCase()} />}
          >
            {sourceTabs}
            <TicketBox label={c.sendTo}>{agentPill('USDG')}</TicketBox>
            <div className="mn-net-line">
              <ChainLogo chainId={ROBINHOOD} size={26} />
              <span className="mn-net-text">
                <small>{moneyCopy.receive.network}</small>
                <strong>{moneyCopy.receive.networkValue}</strong>
              </span>
              <span className="mn-net-text mn-net-takes">
                <small>{moneyCopy.receive.takes}</small>
                <TokenLogo symbol="USDG" size={20} title="USDG" />
              </span>
            </div>
            <div className="kit-address-line">
              <code>{agent.address}</code>
              <button type="button" onClick={() => void navigator.clipboard?.writeText(agent.address)}>
                <Copy aria-hidden="true" size={14} /> {moneyCopy.receive.copy}
              </button>
            </div>
            <Callout tone="agent" title={moneyCopy.receive.agentCalloutTitle}>
              {moneyCopy.receive.agentCallout}
            </Callout>
            {agentPicker}
          </FlowCard>
          <div className="kit-money-side" style={{ alignItems: 'center' }}>
            <QrCard
              text={agent.address}
              label={c.anywhereCaption}
              badge={<BoundaryBadge kind="agent" label={agent.name.toUpperCase()} />}
              caption={c.anywhereCaption}
            />
          </div>
        </div>
      </Screen>
    )
  }

  const walletOptions = assets.map((a) => ({
    key: a.token,
    symbol: a.symbol,
    name: a.name,
    chainId: ROBINHOOD,
    held: readable(a.balanceRaw, a.decimals),
    usd: a.valueUsd === null ? null : dollars(a.valueUsd),
    note: a.kind === 'usdg' ? c.goesStraight : a.kind === 'eth' ? c.swapped : c.stockIn,
  }))
  const chainOptions = chains.flatMap((ch) =>
    ch.tokens
      .filter((tk) => hasCryptoLogo(tk.symbol))
      .slice(0, PER_CHAIN)
      .map((tk) => ({
        key: `${ch.id}:${tk.address}`,
        symbol: tk.symbol,
        name: tk.name,
        chainId: ch.id,
      })),
  )
  const worth = source === 'wallet' && asset ? worthOf(asset, amount) : null
  const arriving =
    source === 'wallet' && asset
      ? asset.kind === 'usdg'
        ? c.goesStraight
        : asset.kind === 'eth'
          ? c.swapped
          : c.stockIn
      : ' '

  return (
    <Screen width={1100} gap={8}>
      <ScreenTitle title={c.title} sub={c.sub} />
      <MoveFlow
        title={c.cardTitle(agent.name)}
        icon={<ArrowDownToLine size={16} />}
        badge={<BoundaryBadge kind="agent" label={agent.name.toUpperCase()} />}
        owner={owner}
        input={input}
        invalid={invalid}
        reviewLabel={c.review}
        doneTitle={c.done}
        route={{
          from: {
            chainId: paying?.chainId ?? ROBINHOOD,
            label:
              source === 'wallet'
                ? c.sources.wallet
                : (CHAIN_LOGOS[paying?.chainId ?? 0]?.name ?? c.sources.chain),
          },
          to: { chainId: ROBINHOOD, label: agent.name },
        }}
        aside={
          source === 'wallet' && assets.length > 0 ? (
            <WalletList
              selected={assetToken}
              lines={assets.map((a) => ({
                key: a.token,
                symbol: a.symbol,
                name: a.name,
                held: readable(a.balanceRaw, a.decimals),
                usd: a.valueUsd === null ? null : dollars(a.valueUsd),
              }))}
            />
          ) : source === 'chain' ? (
            <NetworksCard via={['relay']} />
          ) : undefined
        }
        after={
          <Link
            href={`/agents/${agent.slug}` as Route}
            style={{ fontSize: 12.5, color: 'var(--ac2)', fontWeight: 600, textAlign: 'center' }}
          >
            {c.openAgent(agent.name)} →
          </Link>
        }
        ticket={(q) => (
          <>
            {sourceTabs}
            {source === 'wallet' && assets.length === 0 ? (
              <MoneyEmpty
                marks={[{ chain: 8453 }, { chain: 42161 }, { chain: 1 }]}
                title={c.emptyWalletTitle}
                body={c.emptyWallet}
              >
                <button type="button" style={buttonStyle('secondary')} onClick={() => setSource('chain')}>
                  {c.bringIn}
                </button>
              </MoneyEmpty>
            ) : (
              <>
                <TicketBox
                  label={t.youPay}
                  side={
                    source === 'wallet' && asset ? (
                      <>
                        {t.held(`${readable(asset.balanceRaw, asset.decimals)} ${asset.symbol}`)}
                        <button
                          type="button"
                          onClick={() => setAmount(formatUnits(BigInt(asset.balanceRaw), asset.decimals))}
                        >
                          {t.max}
                        </button>
                      </>
                    ) : undefined
                  }
                  foot={
                    stable ? (
                      <span className="kit-presets">
                        {PRESETS.map((p) => (
                          <button key={p} type="button" onClick={() => setAmount(p)}>
                            ${p}
                          </button>
                        ))}
                      </span>
                    ) : worth ? (
                      t.worth(worth)
                    ) : source === 'chain' ? (
                      c.relayNote
                    ) : (
                      ' '
                    )
                  }
                >
                  <TicketAmount
                    value={amount}
                    onChange={setAmount}
                    label={`${paying?.symbol ?? ''} amount`}
                    invalid={Boolean(invalid && amount)}
                  />
                  {paying ? (
                    <AssetPill
                      symbol={paying.symbol}
                      chainId={paying.chainId}
                      onClick={() => setPicking('asset')}
                    />
                  ) : null}
                </TicketBox>
                <TicketArrow />
                <TicketBox
                  label={t.agentGets}
                  foot={q.quote ? t.worth(dollars(Number(q.quote.usdgValue) / 1e6)) : arriving}
                >
                  <TicketQuoted
                    text={q.quote ? readable(q.quote.receive.amountRaw, q.quote.receive.decimals) : null}
                    loading={q.loading}
                  />
                  {agentPill(q.quote?.receive.symbol ?? 'USDG')}
                </TicketBox>
              </>
            )}
            <AssetPicker
              open={picking === 'asset'}
              onClose={() => setPicking(null)}
              title={source === 'wallet' ? t.pickToken : t.pickChainToken}
              selected={source === 'wallet' ? assetToken : origin}
              options={source === 'wallet' ? walletOptions : chainOptions}
              onPick={(key) => {
                if (source === 'wallet') setAssetToken(key)
                else setOrigin(key)
                setAmount('')
              }}
            />
            {agentPicker}
          </>
        )}
      />
    </Screen>
  )
}

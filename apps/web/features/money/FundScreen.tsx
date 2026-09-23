'use client'

import { moneyCopy } from '@desk/shared'
import { ArrowDownToLine } from 'lucide-react'
import type { Route } from 'next'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { type Address, formatUnits, parseUnits } from 'viem'
import {
  AmountInput,
  BoundaryBadge,
  Callout,
  Chip,
  Eyebrow,
  QrCard,
  Screen,
  ScreenTitle,
  Segmented,
} from '@/components/kit'
import { TokenLogo } from '@/components/ui/token-logo'
import { MoveFlow } from './MoveFlow'

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
const PRESETS = ['5', '20', '100']

function toRaw(amount: string, decimals: number): bigint | null {
  if (!/^\d*\.?\d*$/.test(amount) || amount === '' || amount === '.') return null
  try {
    const raw = parseUnits(amount, decimals)
    return raw > 0n ? raw : null
  } catch {
    return null
  }
}

/**
 * Fund an agent (W4). The reference wallet's Shield · deposit, opened to any token: from your own wallet on
 * Robinhood Chain (USDG straight in, ETH swapped, a Stock Token as it is or swapped), from another chain through
 * Relay, or from anywhere to the agent's address. The server plans each case; your wallet signs it.
 */
export function FundScreen({
  owner,
  agents,
  assets,
  chains,
  initialAgent,
}: {
  owner: string
  agents: FundAgent[]
  assets: FundAsset[]
  chains: FundChain[]
  initialAgent: string | null
}) {
  const [agentKey, setAgentKey] = useState(
    agents.find((a) => a.slug === initialAgent || a.id === initialAgent)?.id ?? agents[0]?.id ?? '',
  )
  const [source, setSource] = useState<'wallet' | 'chain' | 'anywhere'>('wallet')
  const [assetToken, setAssetToken] = useState<string>(assets[0]?.token ?? '')
  const [chainId, setChainId] = useState<number>(chains[0]?.id ?? 8453)
  const chain = chains.find((ch) => ch.id === chainId)
  const [chainToken, setChainToken] = useState<string>(chain?.tokens[0]?.address ?? '')
  const [amount, setAmount] = useState('')
  const agent = agents.find((a) => a.id === agentKey)

  const asset = assets.find((a) => a.token === assetToken)
  const originToken = chain?.tokens.find((t) => t.address === chainToken) ?? chain?.tokens[0]

  const { input, invalid } = useMemo(() => {
    if (!agent) return { input: null, invalid: null }
    if (source === 'wallet') {
      if (!asset) return { input: null, invalid: c.nothingHeld }
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
    if (source === 'chain') {
      if (!originToken) return { input: null, invalid: null }
      const raw = toRaw(amount, originToken.decimals)
      if (raw === null) return { input: null, invalid: null }
      return {
        input: {
          kind: 'fund' as const,
          deskId: agent.id,
          source: { chainId, token: originToken.address, amountRaw: raw.toString() },
        },
        invalid: null,
      }
    }
    return { input: null, invalid: null }
  }, [agent, source, asset, amount, originToken, chainId])

  if (agents.length === 0) {
    return (
      <Screen width={560}>
        <ScreenTitle title={c.title} sub={c.sub} />
        <Callout tone="info" title={c.noAgentTitle}>
          {c.noAgentBody}{' '}
          <Link href={'/agents/new' as Route} style={{ color: 'var(--ac2)', fontWeight: 700 }}>
            {c.create} →
          </Link>
        </Callout>
      </Screen>
    )
  }

  const unit = source === 'wallet' ? (asset?.symbol ?? '') : (originToken?.symbol ?? '')
  const held = source === 'wallet' && asset ? formatUnits(BigInt(asset.balanceRaw), asset.decimals) : null

  const form = (
    <>
      {source === 'wallet' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Eyebrow>{c.fromWallet}</Eyebrow>
          {assets.length === 0 ? (
            <Callout tone="wallet">
              {c.emptyWallet}{' '}
              <button type="button" className="kit-link" onClick={() => setSource('chain')}>
                {c.bringIn}
              </button>
            </Callout>
          ) : (
            <div className="kit-asset-list">
              {assets.map((a) => {
                const on = a.token === assetToken
                return (
                  <button
                    key={a.token}
                    type="button"
                    aria-pressed={on}
                    className="kit-asset"
                    data-on={on || undefined}
                    onClick={() => {
                      setAssetToken(a.token)
                      setAmount('')
                    }}
                  >
                    <TokenLogo symbol={a.kind === 'usdg' ? 'CASH' : a.symbol} size={26} />
                    <span className="kit-asset-name">
                      <strong>{a.symbol}</strong>
                      <em>{a.kind === 'usdg' ? c.goesStraight : a.kind === 'eth' ? c.swapped : c.stockIn}</em>
                    </span>
                    <span className="kit-asset-held">
                      <b>
                        {Number(formatUnits(BigInt(a.balanceRaw), a.decimals)).toLocaleString('en-US', {
                          maximumFractionDigits: 5,
                        })}
                      </b>
                      <em>{a.valueUsd === null ? '—' : `$${a.valueUsd.toFixed(2)}`}</em>
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Eyebrow>{c.sourceChain}</Eyebrow>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {chains.map((ch) => (
              <Chip
                key={ch.id}
                label={ch.name}
                active={ch.id === chainId}
                onClick={() => {
                  setChainId(ch.id)
                  setChainToken(ch.tokens[0]?.address ?? '')
                  setAmount('')
                }}
              />
            ))}
          </div>
          <Eyebrow>{c.token}</Eyebrow>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {chain?.tokens.slice(0, 10).map((t) => (
              <Chip
                key={t.address}
                label={t.symbol}
                active={t.address === originToken?.address}
                onClick={() => {
                  setChainToken(t.address)
                  setAmount('')
                }}
              />
            ))}
          </div>
        </div>
      )}

      {assets.length > 0 || source === 'chain' ? (
        <div
          style={{
            border: '1px solid var(--bd2)',
            borderRadius: 14,
            background: 'var(--card)',
            padding: '20px 16px',
          }}
        >
          <AmountInput
            value={amount}
            onChange={setAmount}
            unit={unit}
            autoFocus
            invalid={Boolean(invalid)}
            {...(held && Number(held) > 0 ? { onMax: () => setAmount(held) } : {})}
            {...(unit === 'USDG' || unit === 'USDC'
              ? { presets: PRESETS.map((p) => `$${p}`), onPreset: (p: string) => setAmount(p.slice(1)) }
              : {})}
            caption={
              held !== null
                ? c.available(Number(held).toLocaleString('en-US', { maximumFractionDigits: 6 }), unit)
                : c.relayNote
            }
          />
        </div>
      ) : null}
    </>
  )

  return (
    <Screen width={560} gap={8}>
      <ScreenTitle title={c.title} sub={c.sub} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, margin: '8px 0 8px' }}>
        {agents.length > 1 ? (
          <Segmented
            label={c.intoWhich}
            options={agents.map((a) => ({ value: a.id, label: a.name }))}
            value={agentKey}
            onChange={setAgentKey}
            size="sm"
          />
        ) : null}
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
      </div>

      {source === 'anywhere' && agent ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
          <QrCard
            text={agent.address}
            label={c.anywhereCaption}
            badge={<BoundaryBadge kind="agent" label={agent.name.toUpperCase()} />}
            caption={c.anywhereCaption}
          />
          <code
            style={{
              fontFamily: 'var(--fm)',
              fontSize: 12,
              color: 'var(--tx2)',
              wordBreak: 'break-all',
              textAlign: 'center',
            }}
          >
            {agent.address}
          </code>
          <Callout tone="agent" title={moneyCopy.receive.agentCalloutTitle}>
            {moneyCopy.receive.agentCallout}
          </Callout>
          <Link
            href={`/receive?agent=${agent.slug}` as Route}
            style={{ fontSize: 12.5, color: 'var(--ac2)', fontWeight: 600 }}
          >
            {c.openReceive} →
          </Link>
        </div>
      ) : agent ? (
        <MoveFlow
          title={c.cardTitle(agent.name)}
          icon={<ArrowDownToLine size={16} />}
          badge={<BoundaryBadge kind="agent" label={agent.name.toUpperCase()} />}
          owner={owner}
          input={input}
          form={form}
          invalid={invalid}
          reviewLabel={c.review}
          doneTitle={c.done}
          after={
            <Link
              href={`/agents/${agent.slug}` as Route}
              style={{ fontSize: 12.5, color: 'var(--ac2)', fontWeight: 600, textAlign: 'center' }}
            >
              {c.openAgent(agent.name)} →
            </Link>
          }
        />
      ) : null}
    </Screen>
  )
}

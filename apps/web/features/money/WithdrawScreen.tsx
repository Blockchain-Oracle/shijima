'use client'

import { moneyCopy } from '@desk/shared'
import { ArrowUpFromLine } from 'lucide-react'
import type { Route } from 'next'
import Link from 'next/link'
import { useState, useTransition } from 'react'
import type { Address } from 'viem'
import { proposeAction } from '@/app/owner-actions'
import {
  AmountInput,
  BoundaryBadge,
  Button,
  Callout,
  Eyebrow,
  FlowCard,
  Screen,
  ScreenTitle,
  Segmented,
} from '@/components/kit'
import { TokenLogo } from '@/components/ui/token-logo'
import type { ChatCard } from '@/features/desk/chat-model'
import { ProposalCard } from '@/features/desk/ProposalCard'
import { DeskSessionProvider } from '@/features/session/DeskSessionProvider'

export interface WithdrawAgent {
  id: string
  slug: string
  name: string
  address: string
  owner: string
  contractVersion: string
  cashUsd: number
  savingsUsd: number
  stocks: { symbol: string; name: string; valueUsd: number | null }[]
}

type What = 'cash' | 'stock' | 'everything'
const c = moneyCopy.withdraw

/**
 * Withdraw (W5), the reference wallet's Unshield · withdraw, from an agent back to your own wallet, the only place
 * the contract will pay. Cash, some or all; one stock, sold to cash or taken as it is; or everything, as cash or
 * as it is. It makes the same card the agent's own controls make, checked by the server against the chain, and
 * nothing moves until you confirm it in your wallet (or with this browser's key, where the agent allows it).
 */
export function WithdrawScreen({
  agents,
  initialAgent,
}: {
  agents: WithdrawAgent[]
  initialAgent: string | null
}) {
  const [agentId, setAgentId] = useState(
    agents.find((a) => a.slug === initialAgent || a.id === initialAgent)?.id ?? agents[0]?.id ?? '',
  )
  const agent = agents.find((a) => a.id === agentId)
  const [what, setWhat] = useState<What>('cash')
  const [amount, setAmount] = useState('')
  const [symbol, setSymbol] = useState(agent?.stocks[0]?.symbol ?? '')
  const [sell, setSell] = useState<'sell' | 'as_is'>('as_is')
  const [asCash, setAsCash] = useState(true)
  const [card, setCard] = useState<ChatCard | null>(null)
  const [why, setWhy] = useState<string | null>(null)
  const [pending, start] = useTransition()

  if (!agent) {
    return (
      <Screen width={560}>
        <ScreenTitle title={c.title} sub={c.sub} />
        <Callout tone="info">{c.noAgent}</Callout>
      </Screen>
    )
  }

  const stock = agent.stocks.find((s) => s.symbol === symbol) ?? agent.stocks[0]
  const tooMuch = what === 'cash' && Number(amount) > agent.cashUsd + agent.savingsUsd + 1e-9

  const request = (): {
    kind: 'withdraw' | 'sell_some'
    words: string
    fields: Record<string, string | null>
  } => {
    if (what === 'cash')
      return {
        kind: 'withdraw',
        words: c.words.cash(amount),
        fields: { amountUsdg: amount, withdrawAs: 'usdg' },
      }
    if (what === 'everything')
      return {
        kind: 'withdraw',
        words: c.words.everything(asCash),
        fields: { amountUsdg: null, withdrawAs: asCash ? 'usdg' : 'stocks' },
      }
    const dollars = amount.trim() === '' ? null : amount
    return sell === 'sell'
      ? {
          kind: 'sell_some',
          words: c.words.sell(stock?.symbol ?? ''),
          fields: { symbol: stock?.symbol ?? null, amountUsdg: dollars },
        }
      : {
          kind: 'withdraw',
          words: c.words.stock(stock?.symbol ?? ''),
          fields: { withdrawAs: 'stock', symbol: stock?.symbol ?? null, amountUsdg: dollars },
        }
  }

  const review = () =>
    start(async () => {
      setWhy(null)
      const made = await proposeAction({ deskId: agent.id, ...request() })
      if (made.ok) setCard(made.card)
      else setWhy(made.why)
    })

  const ready = what === 'everything' || (what === 'cash' ? Number(amount) > 0 && !tooMuch : Boolean(stock))

  return (
    <Screen width={560} gap={8}>
      <ScreenTitle title={c.title} sub={c.sub} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, margin: '8px 0' }}>
        {agents.length > 1 ? (
          <Segmented
            label={c.fromWhich}
            size="sm"
            options={agents.map((a) => ({ value: a.id, label: a.name }))}
            value={agentId}
            onChange={(v) => {
              setAgentId(v)
              setCard(null)
              setAmount('')
            }}
          />
        ) : null}
        <Segmented
          label={c.what}
          fullWidth
          options={[
            { value: 'cash', label: c.whats.cash },
            { value: 'stock', label: c.whats.stock },
            { value: 'everything', label: c.whats.everything },
          ]}
          value={what}
          onChange={(v) => {
            setWhat(v as What)
            setCard(null)
            setAmount('')
          }}
        />
      </div>

      <DeskSessionProvider
        owner={agent.owner as Address}
        desk={agent.address as Address}
        contractVersion={agent.contractVersion}
      >
        <FlowCard
          icon={<ArrowUpFromLine size={16} />}
          title={c.cardTitle(agent.name)}
          badge={<BoundaryBadge kind="wallet" label={c.toYourWallet} />}
        >
          {card ? (
            <>
              <ProposalCard card={card} />
              <div
                style={{
                  display: 'flex',
                  gap: 14,
                  flexWrap: 'wrap',
                  justifyContent: 'center',
                  fontSize: 12.5,
                }}
              >
                <Link href={'/send' as Route} style={{ color: 'var(--ac2)', fontWeight: 600 }}>
                  {c.sendOn} →
                </Link>
                <Link href={'/bridge?dir=out' as Route} style={{ color: 'var(--ac2)', fontWeight: 600 }}>
                  {c.bridgeOut} →
                </Link>
                <button type="button" className="kit-link" onClick={() => setCard(null)}>
                  {c.another}
                </button>
              </div>
            </>
          ) : (
            <>
              <Callout tone="wallet" title={c.onlyYouTitle}>
                {c.onlyYou}
              </Callout>

              {what === 'cash' ? (
                <div
                  style={{
                    border: '1px solid var(--bd2)',
                    borderRadius: 14,
                    background: 'var(--card)',
                    padding: '20px 16px',
                  }}
                >
                  <AmountInput
                    prefix="$"
                    unit="USDG"
                    value={amount}
                    onChange={setAmount}
                    autoFocus
                    invalid={tooMuch}
                    onMax={() => setAmount((agent.cashUsd + agent.savingsUsd).toFixed(2))}
                    caption={c.cashHeld(
                      `$${agent.cashUsd.toFixed(2)}`,
                      agent.savingsUsd > 0.005 ? `$${agent.savingsUsd.toFixed(2)}` : null,
                    )}
                  />
                </div>
              ) : what === 'stock' ? (
                agent.stocks.length === 0 ? (
                  <Callout tone="info">{c.noStocks}</Callout>
                ) : (
                  <>
                    <Eyebrow>{c.whichStock}</Eyebrow>
                    <div className="kit-asset-list">
                      {agent.stocks.map((s) => (
                        <button
                          key={s.symbol}
                          type="button"
                          aria-pressed={s.symbol === stock?.symbol}
                          className="kit-asset"
                          data-on={s.symbol === stock?.symbol || undefined}
                          onClick={() => setSymbol(s.symbol)}
                        >
                          <TokenLogo symbol={s.symbol} size={26} />
                          <span className="kit-asset-name">
                            <strong>{s.symbol}</strong>
                            <em>{s.name}</em>
                          </span>
                          <span className="kit-asset-held">
                            <b>{s.valueUsd === null ? '—' : `$${s.valueUsd.toFixed(2)}`}</b>
                          </span>
                        </button>
                      ))}
                    </div>
                    <Segmented
                      label={c.how}
                      fullWidth
                      size="sm"
                      options={[
                        { value: 'as_is', label: c.asIs },
                        { value: 'sell', label: c.sellToCash },
                      ]}
                      value={sell}
                      onChange={(v) => setSell(v as 'sell' | 'as_is')}
                    />
                    <div
                      style={{
                        border: '1px solid var(--bd2)',
                        borderRadius: 14,
                        background: 'var(--card)',
                        padding: '16px',
                      }}
                    >
                      <AmountInput
                        prefix="$"
                        unit={stock?.symbol ?? ''}
                        value={amount}
                        onChange={setAmount}
                        caption={c.blankIsAll}
                      />
                    </div>
                    {sell === 'sell' ? <Callout tone="info">{c.sellNote}</Callout> : null}
                  </>
                )
              ) : (
                <Segmented
                  label={c.how}
                  fullWidth
                  options={[
                    { value: 'cash', label: c.everythingCash },
                    { value: 'as_is', label: c.everythingAsIs },
                  ]}
                  value={asCash ? 'cash' : 'as_is'}
                  onChange={(v) => setAsCash(v === 'cash')}
                />
              )}

              {tooMuch ? <Callout tone="warn">{c.tooMuch}</Callout> : null}
              {why ? <Callout tone="warn">{why}</Callout> : null}
              <Button fullWidth loading={pending} disabled={!ready || pending} onClick={review}>
                {c.review}
              </Button>
            </>
          )}
        </FlowCard>
      </DeskSessionProvider>
    </Screen>
  )
}

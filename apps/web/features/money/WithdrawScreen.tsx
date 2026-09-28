'use client'

import { moneyCopy } from '@desk/shared'
import { ArrowUpFromLine, ListChecks } from 'lucide-react'
import type { Route } from 'next'
import Link from 'next/link'
import { useState, useTransition } from 'react'
import type { Address } from 'viem'
import { proposeAction } from '@/app/owner-actions'
import {
  BoundaryBadge,
  Button,
  buttonStyle,
  Callout,
  FlowCard,
  Screen,
  ScreenTitle,
  Segmented,
} from '@/components/kit'
import {
  AssetPicker,
  AssetPill,
  dollars,
  TicketAmount,
  TicketArrow,
  TicketBox,
  TicketQuoted,
} from '@/components/kit/ticket'
import type { ChatCard } from '@/features/desk/chat-model'
import { ProposalCard } from '@/features/desk/ProposalCard'
import { DeskSessionProvider } from '@/features/session/DeskSessionProvider'
import { HoldingsBreakdown, MoneyEmpty } from './MoneyParts'

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
const t = moneyCopy.ticket
const ROBINHOOD = 4663

/**
 * Withdraw (W5) on the money ticket: out of which agent and what on the left, with what arrives in your wallet
 * under it; the agent's holdings, Review and the card to confirm on the right. It makes the same card the agent's
 * own controls make, checked by the server against the chain, and it always pays your own wallet, the only place
 * the contract will pay.
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
  const [picking, setPicking] = useState<'agent' | 'stock' | null>(null)
  const [pending, start] = useTransition()

  if (!agent) {
    return (
      <Screen width={1100}>
        <ScreenTitle title={c.title} sub={c.sub} />
        <MoneyEmpty
          marks={[{ token: 'USDG' }, { chain: 4663 }, { token: 'NVDA' }]}
          title={c.noAgent}
          body={moneyCopy.fund.noAgentBody}
        >
          <Link href={'/agents/new' as Route} style={buttonStyle('primary')}>
            {moneyCopy.fund.create}
          </Link>
        </MoneyEmpty>
      </Screen>
    )
  }

  const stock = agent.stocks.find((s) => s.symbol === symbol) ?? agent.stocks[0]
  const cashAndSavings = agent.cashUsd + agent.savingsUsd
  const stocksUsd = agent.stocks.reduce((sum, s) => sum + (s.valueUsd ?? 0), 0)
  const tooMuch = what === 'cash' && Number(amount) > cashAndSavings + 1e-9

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
    const dollarsOut = amount.trim() === '' ? null : amount
    return sell === 'sell'
      ? {
          kind: 'sell_some',
          words: c.words.sell(stock?.symbol ?? ''),
          fields: { symbol: stock?.symbol ?? null, amountUsdg: dollarsOut },
        }
      : {
          kind: 'withdraw',
          words: c.words.stock(stock?.symbol ?? ''),
          fields: { withdrawAs: 'stock', symbol: stock?.symbol ?? null, amountUsdg: dollarsOut },
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
  const reset = () => {
    setCard(null)
    setAmount('')
  }

  /** What arrives, as the ticket's lower box shows it. */
  const arrives =
    what === 'cash'
      ? { text: amount || null, symbol: 'USDG' }
      : what === 'stock'
        ? sell === 'sell'
          ? { text: amount || (stock?.valueUsd ? stock.valueUsd.toFixed(2) : null), symbol: 'USDG' }
          : {
              text: amount || (stock?.valueUsd ? stock.valueUsd.toFixed(2) : null),
              symbol: stock?.symbol ?? 'USDG',
            }
        : { text: (cashAndSavings + stocksUsd).toFixed(2), symbol: 'USDG' }

  return (
    <Screen width={1100} gap={8}>
      <ScreenTitle title={c.title} sub={c.sub} />
      <DeskSessionProvider
        owner={agent.owner as Address}
        desk={agent.address as Address}
        contractVersion={agent.contractVersion}
      >
        <div className="kit-money">
          <FlowCard
            icon={<ArrowUpFromLine size={16} />}
            title={c.cardTitle(agent.name)}
            badge={<BoundaryBadge kind="wallet" label={c.toYourWallet} />}
          >
            <div className={card ? 'kit-ticket kit-money-locked' : 'kit-ticket'}>
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
                  reset()
                }}
              />
              <TicketBox
                label={c.outOf}
                side={
                  what === 'cash' ? (
                    <>
                      {t.held(dollars(cashAndSavings))}
                      <button type="button" onClick={() => setAmount(cashAndSavings.toFixed(2))}>
                        {t.max}
                      </button>
                    </>
                  ) : undefined
                }
                foot={
                  what === 'cash'
                    ? c.cashHeld(
                        dollars(agent.cashUsd),
                        agent.savingsUsd > 0.005 ? dollars(agent.savingsUsd) : null,
                      )
                    : what === 'stock'
                      ? c.blankIsAll
                      : c.everythingNote(dollars(cashAndSavings + stocksUsd))
                }
              >
                {what === 'everything' ? (
                  <TicketQuoted text={(cashAndSavings + stocksUsd).toFixed(2)} />
                ) : (
                  <TicketAmount value={amount} onChange={setAmount} label={c.amountLabel} invalid={tooMuch} />
                )}
                {what === 'stock' && stock ? (
                  <AssetPill
                    symbol={stock.symbol}
                    chainId={ROBINHOOD}
                    label={stock.symbol}
                    onClick={() => setPicking('stock')}
                  />
                ) : (
                  <AssetPill
                    symbol="USDG"
                    chainId={ROBINHOOD}
                    label={agent.name}
                    {...(agents.length > 1 ? { onClick: () => setPicking('agent') } : {})}
                  />
                )}
              </TicketBox>
              {what === 'stock' && agent.stocks.length === 0 ? (
                <Callout tone="info">{c.noStocks}</Callout>
              ) : null}
              {what === 'stock' && stock ? (
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
              ) : null}
              {what === 'everything' ? (
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
              ) : null}
              <TicketArrow />
              <TicketBox
                label={what === 'stock' && sell === 'sell' ? c.staysInAgent : c.arrives}
                foot={what === 'stock' && sell === 'sell' ? c.sellNote : c.onlyYou}
              >
                <TicketQuoted text={arrives.text} />
                {what === 'stock' && sell === 'sell' ? (
                  <AssetPill symbol="USDG" chainId={ROBINHOOD} label={agent.name} />
                ) : what === 'everything' && !asCash ? (
                  <AssetPill
                    symbol={agent.stocks[0]?.symbol ?? 'USDG'}
                    chainId={ROBINHOOD}
                    label={c.yourWallet}
                  />
                ) : (
                  <AssetPill symbol={arrives.symbol} chainId={ROBINHOOD} label={c.yourWallet} />
                )}
              </TicketBox>
            </div>
          </FlowCard>

          <div className="kit-money-side">
            {card ? (
              <FlowCard icon={<ListChecks size={16} />} title={t.summary}>
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
                  <button type="button" className="kit-link" onClick={reset}>
                    {c.another}
                  </button>
                </div>
              </FlowCard>
            ) : (
              <FlowCard icon={<ListChecks size={16} />} title={c.holdingsTitle(agent.name)}>
                <HoldingsBreakdown
                  caption={c.holdingsCaption}
                  lines={[
                    { key: 'cash', symbol: 'USDG', name: c.cash, sub: 'USDG', valueUsd: agent.cashUsd },
                    ...(agent.savingsUsd > 0.005
                      ? [
                          {
                            key: 'savings',
                            symbol: 'USDG',
                            name: c.savings,
                            sub: 'USDG',
                            valueUsd: agent.savingsUsd,
                          },
                        ]
                      : []),
                    ...agent.stocks.map((s) => ({
                      key: s.symbol,
                      symbol: s.symbol,
                      name: s.name,
                      sub: s.symbol,
                      valueUsd: s.valueUsd,
                    })),
                  ]}
                />
                <dl className="kit-summary-rows" style={{ borderTop: '1px solid var(--bd)' }}>
                  <div data-strong>
                    <dt>{c.total}</dt>
                    <dd>{dollars(cashAndSavings + stocksUsd)}</dd>
                  </div>
                </dl>
                {tooMuch ? <Callout tone="warn">{c.tooMuch}</Callout> : null}
                {why ? <Callout tone="warn">{why}</Callout> : null}
                <Button fullWidth loading={pending} disabled={!ready || pending} onClick={review}>
                  {c.review}
                </Button>
              </FlowCard>
            )}
          </div>
        </div>
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
            usd: dollars(a.cashUsd + a.savingsUsd + a.stocks.reduce((s, x) => s + (x.valueUsd ?? 0), 0)),
          }))}
          onPick={(id) => {
            setAgentId(id)
            setSymbol(agents.find((a) => a.id === id)?.stocks[0]?.symbol ?? '')
            reset()
          }}
        />
        <AssetPicker
          open={picking === 'stock'}
          onClose={() => setPicking(null)}
          title={c.whichStock}
          selected={stock?.symbol ?? ''}
          options={agent.stocks.map((s) => ({
            key: s.symbol,
            symbol: s.symbol,
            name: s.name,
            chainId: ROBINHOOD,
            usd: s.valueUsd === null ? null : dollars(s.valueUsd),
          }))}
          onPick={(sym) => {
            setSymbol(sym)
            setAmount('')
          }}
        />
      </DeskSessionProvider>
    </Screen>
  )
}

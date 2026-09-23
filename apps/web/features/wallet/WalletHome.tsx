'use client'

import { appCopy, deskCopy, moneyCopy, short } from '@desk/shared'
import {
  ArrowDown,
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpFromLine,
  ArrowUpRight,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react'
import type { Route } from 'next'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { type ReactNode, useRef, useState, useTransition } from 'react'
import {
  AgentsCard,
  Button,
  buttonStyle,
  Callout,
  Eyebrow,
  Pill,
  Screen,
  ScreenTitle,
  StatusPill,
  type TxStatus,
  WalletCard,
} from '@/components/kit'
import { TokenLogo, TokenStack } from '@/components/ui/token-logo'
import { When } from '@/components/when'
import { PortfolioChart } from '@/features/desk/PortfolioChart'
import { GiftCard } from '@/features/gift/GiftCard'

export interface WalletViewHolding {
  kind: 'usdg' | 'eth' | 'stock'
  symbol: string
  name: string
  amount: string
  valueUsd: number | null
}

export interface WalletViewAgent {
  id: string
  slug: string
  name: string
  mode: 'shadow' | 'ask_first' | 'on_its_own'
  state: string
  cashUsd: number
  savingsUsd: number
  stocksUsd: number
  totalUsd: number
  symbols: string[]
  changePct: number | null
  needsYou: number
  latest: { summary: string; outcome: string; at: string } | null
  checked: boolean
}

export interface WalletViewActivity {
  kind: 'decision' | 'move'
  title: string
  detail: string
  amountUsd: number | null
  status: 'pending' | 'done' | 'failed' | 'onItsWay' | 'maybeSent' | 'quiet'
  /** The pill's words when they are not the status's own: a decision's outcome. */
  label?: string | undefined
  href: string | null
  at: string
  agentName: string | null
}

export interface WalletView {
  address: string
  wallet: { holdings: WalletViewHolding[]; totalUsd: number } | null
  agents: WalletViewAgent[]
  agentsTotalUsd: number
  unpriced: string[]
  activity: WalletViewActivity[]
  needs: number
  combined: { t: number; value: number }[]
}

const usd = (n: number) =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const STATUS: Record<WalletViewActivity['status'], TxStatus> = {
  pending: 'pending',
  done: 'done',
  failed: 'failed',
  onItsWay: 'onItsWay',
  maybeSent: 'working',
  quiet: 'confirmed',
}

const c = moneyCopy.wallet

/**
 * The Wallet, as the reference wallet's Home (apps/web/src/wallet/HomeScreen.tsx:185-235): a title row with its
 * sync pill, one card split in three (your agents' money on the left, the ways to move money across the middle,
 * your own wallet on the right), the action row, and the latest activity. Shijima adds each agent's card, the
 * combined chart and the free $1 below. On a phone the two sides become a swipeable pair with dots
 * (apps/mobile/src/MobileHome.tsx:84-116) and the actions become four tiles.
 */
export function WalletHome({ view }: { view: WalletView }) {
  const router = useRouter()
  const [syncing, startSync] = useTransition()
  const [face, setFace] = useState<'agents' | 'wallet'>('agents')
  const rail = useRef<HTMLDivElement>(null)

  const cash = view.agents.reduce((s, a) => s + a.cashUsd, 0)
  const savings = view.agents.reduce((s, a) => s + a.savingsUsd, 0)
  const stocks = view.agents.reduce((s, a) => s + a.stocksUsd, 0)

  const show = (next: 'agents' | 'wallet') => {
    setFace(next)
    rail.current?.scrollTo({ left: next === 'wallet' ? rail.current.clientWidth : 0, behavior: 'smooth' })
  }

  const agentsFace = (
    <div className="kit-bal">
      <div className="kit-bal-top">
        <span className="kit-bal-eyebrow">
          <i aria-hidden="true" /> {c.agentsEyebrow}
        </span>
        <span className="kit-bal-chip">{c.agentsCount(view.agents.length)}</span>
      </div>
      {view.agents.length === 0 ? (
        <div className="kit-bal-empty">
          <strong>{c.noAgents}</strong>
          <span>{c.noAgentsBody}</span>
        </div>
      ) : (
        <>
          <div className="kit-bal-figure">
            <span className="kit-bal-big">{usd(view.agentsTotalUsd)}</span>
            <span className="kit-bal-unit">USDG</span>
          </div>
          <div className="kit-bal-foot">
            <span className="kit-bal-ok">
              <i aria-hidden="true" />
              {c.split(usd(cash), usd(stocks))}
            </span>
            {savings > 0.005 ? <span className="kit-bal-note">{c.savings(usd(savings))}</span> : null}
            <span className="kit-bal-hint">{c.flipHint}</span>
          </div>
        </>
      )}
    </div>
  )

  const agentsBack = (
    <div className="kit-bal kit-bal--back">
      <div className="kit-bal-top">
        <span className="kit-bal-eyebrow">{c.eachAgent}</span>
        <span className="kit-bal-hint">{c.flipBack}</span>
      </div>
      {view.agents.slice(0, 4).map((a) => (
        <div key={a.id} className="kit-bal-row">
          <TokenLogo symbol={a.symbols[0] ?? 'CASH'} size={18} />
          <span className="kit-bal-row-name">{a.name}</span>
          <span className="kit-bal-row-value">{usd(a.totalUsd)}</span>
          <span className="kit-bal-row-note">
            {a.changePct === null ? '—' : `${a.changePct >= 0 ? '+' : ''}${a.changePct.toFixed(2)}%`}
          </span>
        </div>
      ))}
    </div>
  )

  const walletFace = (
    <div className="kit-bal kit-bal--wallet">
      <span className="kit-bal-chip kit-bal-chip--wallet">{c.walletEyebrow}</span>
      {view.wallet === null ? (
        <div className="kit-bal-empty">
          <span>{c.walletFailed}</span>
          <button type="button" className="kit-link" onClick={() => startSync(() => router.refresh())}>
            {c.retry}
          </button>
        </div>
      ) : (
        <div className="kit-bal-assets">
          {view.wallet.holdings.slice(0, 4).map((h) => (
            <div key={h.symbol} className="kit-bal-asset">
              <TokenLogo symbol={h.kind === 'usdg' ? 'CASH' : h.symbol} size={20} />
              <span className="kit-bal-asset-amount">{h.amount}</span>
              <span className="kit-bal-asset-symbol">{h.symbol}</span>
              <span className="kit-bal-asset-value">{h.valueUsd === null ? '—' : usd(h.valueUsd)}</span>
            </div>
          ))}
          {view.wallet.holdings.length > 4 ? (
            <span className="kit-bal-note">{c.more(view.wallet.holdings.length - 4)}</span>
          ) : null}
        </div>
      )}
      <div className="kit-bal-wallet-foot">
        <span className="kit-bal-total">
          {view.wallet ? c.walletTotal(usd(view.wallet.totalUsd)) : null}
          <code>{short(view.address, 6, 4)}</code>
        </span>
        <Link href={'/fund' as Route} className="kit-bal-cta">
          {c.fundAgent}
        </Link>
      </div>
    </div>
  )

  return (
    <Screen width={1024}>
      <ScreenTitle
        title={c.title}
        sub={c.sub}
        right={
          <>
            <Pill
              label={syncing ? c.syncing : c.checked}
              tone={syncing ? 'warn' : 'pos'}
              dot
              pulse={syncing}
            />
            <Button
              variant="secondary"
              onClick={() => startSync(() => router.refresh())}
              style={{ padding: '8px 12px', fontSize: 12 }}
            >
              <RefreshCw aria-hidden="true" size={13} className={syncing ? 'kit-pull-spin' : undefined} />
              {c.sync}
            </Button>
          </>
        }
      />

      {/* Desktop and tablet: one card split in three, as the reference's hero strip. */}
      <div className="kit-hero">
        <div className="kit-hero-glow" aria-hidden="true" />
        <div className="kit-hero-strip">
          <AgentsCard
            back={view.agents.length > 0 ? agentsBack : undefined}
            style={{ flex: 1.4, border: 'none', borderRadius: 0 }}
            label={c.eachAgent}
          >
            {agentsFace}
          </AgentsCard>
          <div className="kit-cross">
            <span className="kit-cross-label">{c.cross}</span>
            <CrossLink href="/fund" label={c.actions.fund} icon={<ArrowDownToLine size={15} />} />
            <CrossLink href="/withdraw" label={c.actions.withdraw} icon={<ArrowUpFromLine size={15} />} />
            <CrossLink href="/bridge" label={c.actions.bridge} icon={<ArrowLeftRight size={15} />} />
          </div>
          <WalletCard style={{ flex: 1, border: 'none', borderRadius: 0 }}>{walletFace}</WalletCard>
        </div>
      </div>

      {/* Phone: the two cards as a swipeable pair with dots. */}
      <div className="kit-rail-wrap">
        <div
          className="kit-rail"
          ref={rail}
          onScroll={(e) => {
            const el = e.currentTarget
            setFace(el.scrollLeft > el.clientWidth * 0.45 ? 'wallet' : 'agents')
          }}
        >
          <div className="kit-rail-slide">
            <AgentsCard
              back={view.agents.length > 0 ? agentsBack : undefined}
              style={{ minHeight: 190 }}
              label={c.eachAgent}
            >
              {agentsFace}
            </AgentsCard>
          </div>
          <div className="kit-rail-slide">
            <WalletCard style={{ width: '100%', minHeight: 190 }}>{walletFace}</WalletCard>
          </div>
        </div>
        <div className="kit-dots">
          <button
            type="button"
            data-on={face === 'agents' || undefined}
            aria-label={c.agentsEyebrow}
            onClick={() => show('agents')}
          />
          <button
            type="button"
            data-on={face === 'wallet' || undefined}
            aria-label={c.walletEyebrow}
            onClick={() => show('wallet')}
          />
        </div>
      </div>

      {view.needs > 0 ? (
        <Callout tone="warn" title={c.needsTitle(view.needs)}>
          <Link href={'/activity?tab=needs' as Route} style={{ color: 'var(--warn)', fontWeight: 700 }}>
            {c.needsOpen} →
          </Link>
        </Callout>
      ) : null}
      {view.unpriced.length > 0 ? (
        <Callout tone="wallet">{c.unpriced(view.unpriced.join(', '))}</Callout>
      ) : null}

      <div className="kit-actions">
        <Link
          href={'/fund' as Route}
          style={buttonStyle('primary')}
          className="kit-action kit-action--primary"
        >
          <ArrowDownToLine aria-hidden="true" size={16} /> {c.actions.fund}
        </Link>
        <Link href={'/receive' as Route} style={buttonStyle('secondary')} className="kit-action">
          <ArrowDown aria-hidden="true" size={16} /> {c.actions.receive}
        </Link>
        <Link href={'/withdraw' as Route} style={buttonStyle('secondary')} className="kit-action">
          <ArrowUpFromLine aria-hidden="true" size={16} /> {c.actions.withdraw}
        </Link>
        <Link href={'/send' as Route} style={buttonStyle('secondary')} className="kit-action">
          <ArrowUpRight aria-hidden="true" size={16} /> {c.actions.send}
        </Link>
        <Link
          href={'/bridge' as Route}
          style={buttonStyle('secondary')}
          className="kit-action kit-action--wide"
        >
          <ArrowLeftRight aria-hidden="true" size={16} /> {c.actions.bridge}
        </Link>
        <Link
          href={'/evidence' as Route}
          style={buttonStyle('secondary')}
          className="kit-action kit-action--wide"
        >
          <ShieldCheck aria-hidden="true" size={16} /> {c.actions.evidence}
        </Link>
      </div>

      <section>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>{appCopy.activity.title}</span>
          <Link
            href={'/activity' as Route}
            style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--ac2)', fontWeight: 600 }}
          >
            {c.seeAll} →
          </Link>
        </div>
        <div style={{ borderTop: '1px solid var(--bd)' }}>
          {view.activity.length === 0 ? (
            <p style={{ margin: 0, padding: '16px 2px', fontSize: 12, color: 'var(--tx3)' }}>
              {c.noActivity}
            </p>
          ) : (
            view.activity.slice(0, 3).map((a) => (
              <a
                key={`${a.kind}-${a.at}-${a.title}`}
                href={a.href ?? undefined}
                {...(a.href?.startsWith('http') ? { target: '_blank', rel: 'noreferrer noopener' } : {})}
                className="kit-act-row"
              >
                <span className="kit-act-mark" data-kind={a.kind}>
                  {a.kind === 'move' ? '⇄' : '◆'}
                </span>
                <span className="kit-act-body">
                  <strong>{a.title}</strong>
                  <em>
                    {a.agentName && a.kind === 'decision' ? `${a.agentName} · ` : ''}
                    {a.detail} · <When at={a.at} />
                  </em>
                </span>
                <span className="kit-act-right">
                  {a.amountUsd !== null ? <b>{usd(a.amountUsd)}</b> : null}
                  <StatusPill status={STATUS[a.status]} {...(a.label ? { label: a.label } : {})} />
                </span>
              </a>
            ))
          )}
        </div>
      </section>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>{c.yourAgents}</span>
          <Link
            href={'/agents/new' as Route}
            style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--ac2)', fontWeight: 600 }}
          >
            {appCopy.nav.newAgent} →
          </Link>
        </div>
        {view.agents.length === 0 ? (
          <div className="kit-empty-agents">
            <strong>{appCopy.overview.empty.title}</strong>
            <p>{appCopy.overview.empty.body}</p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
              <Link href={'/agents/new' as Route} style={buttonStyle('primary')}>
                {appCopy.overview.empty.create}
              </Link>
              <Link href={'/agents' as Route} style={buttonStyle('secondary')}>
                {appCopy.overview.empty.copy}
              </Link>
            </div>
          </div>
        ) : (
          <div className="kit-agent-grid">
            {view.agents.map((a) => (
              <Link key={a.id} href={`/agents/${a.slug}` as Route} className="kit-agent-card">
                <span className="kit-agent-card-top">
                  <TokenStack symbols={a.symbols.length ? a.symbols : ['CASH']} max={3} size={26} />
                  <strong>{a.name}</strong>
                  <span className="kit-agent-card-mode">{deskCopy.modes[a.mode]}</span>
                </span>
                <span className="kit-agent-card-value">
                  {usd(a.totalUsd)}
                  {a.changePct !== null ? (
                    <em data-up={a.changePct >= 0 || undefined}>
                      {a.changePct >= 0 ? '+' : ''}
                      {a.changePct.toFixed(2)}%
                    </em>
                  ) : null}
                </span>
                <span className="kit-agent-card-split">
                  {c.agentSplit(usd(a.cashUsd), usd(a.stocksUsd), usd(a.savingsUsd))}
                </span>
                {a.latest ? (
                  <span className="kit-agent-card-latest">
                    <Eyebrow>{c.latest}</Eyebrow>
                    <span>{a.latest.summary}</span>
                  </span>
                ) : null}
                <span className="kit-agent-card-foot">
                  {a.needsYou > 0 ? <StatusPill status="pending" label={c.needs(a.needsYou)} /> : null}
                  <span style={{ marginLeft: 'auto' }}>
                    {a.checked ? moneyCopy.checked.justNow : c.fromSnapshot}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {view.combined.length > 1 ? (
        <section className="kit-panel">
          <div style={{ fontWeight: 700, fontSize: 14 }}>{appCopy.overview.chart}</div>
          <p style={{ margin: '4px 0 12px', fontSize: 12, color: 'var(--tx3)' }}>
            {moneyCopy.chart.netOfMoney}
          </p>
          <PortfolioChart points={view.combined} baseline={view.combined[0]?.value ?? null} height={200} />
        </section>
      ) : null}

      <GiftCard />
    </Screen>
  )
}

function CrossLink({ href, label, icon }: { href: string; label: string; icon: ReactNode }) {
  return (
    <Link href={href as Route} className="kit-cross-btn">
      <span>{icon}</span>
      <em>{label}</em>
    </Link>
  )
}

import { EXPLORER } from '@desk/chain'
import { appCopy, short } from '@desk/shared'
import { ArrowUpRight, Bot, Copy, Fingerprint, Receipt } from 'lucide-react'
import type { Route } from 'next'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { LiveBadge } from '@/components/shell/app/LiveBadge'
import { BrandLogo } from '@/components/ui/brand-logo'
import { ChainLogo } from '@/components/ui/chain-logo'
import { TokenLogo } from '@/components/ui/token-logo'
import { When } from '@/components/when'
import { EmptyTiles } from '@/features/markets/EmptyTiles'
import { liveStats } from '@/lib/live.server'
import '@/styles/kit/discover.css'

export const dynamic = 'force-dynamic'
export const metadata = { title: appCopy.livePage.meta }

const usd = (raw: string) =>
  `$${(Number(raw) / 1e6).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/** A transaction's mark: the stock it traded, the savings vault, or the fingerprint the record sealed. */
function TxMark({ kind, symbol }: { kind: string; symbol: string | null }) {
  if (symbol) return <TokenLogo symbol={symbol} size={36} />
  if (kind === 'checkpoint')
    return (
      <span className="dc-tile dc-tile--ac">
        <Fingerprint aria-hidden="true" />
      </span>
    )
  if (kind === 'sweep' || kind === 'redeem') return <BrandLogo brand="morpho" size={36} />
  return <TokenLogo symbol="USDG" size={36} />
}

/**
 * Live on mainnet, with the proof (PLAN-ROUND-3 D9): the block this browser reads, what the record counts, the
 * latest transactions on the explorer, the copy fees (D10) and the contracts themselves. The counts are 21st's
 * Stats Grid (29195) as bordered cells, each with its real mark; the transactions are 21st's Audit Log With Icon
 * Tiles (28483), each led by the token it moved.
 */
export default async function LivePage() {
  const c = appCopy.livePage
  const s = await liveStats()
  const stats: { label: string; value: number; note: string | null; mark: ReactNode }[] = [
    {
      label: c.stats.agents,
      value: s.agents,
      note: c.stats.agentsNote(s.trading),
      mark: (
        <span className="dc-tile dc-tile--sm">
          <Bot aria-hidden="true" />
        </span>
      ),
    },
    {
      label: c.stats.followers,
      value: s.followers,
      note: null,
      mark: (
        <span className="dc-tile dc-tile--sm">
          <Copy aria-hidden="true" />
        </span>
      ),
    },
    {
      label: c.stats.trades,
      value: s.trades,
      note: c.stats.moved(usd(s.movedUsdg)),
      mark: <TokenLogo symbol="USDG" size={30} />,
    },
    {
      label: c.stats.checkpoints,
      value: s.checkpoints,
      note: null,
      mark: (
        <span className="dc-tile dc-tile--sm dc-tile--ac">
          <Fingerprint aria-hidden="true" />
        </span>
      ),
    },
    {
      label: c.stats.serv,
      value: s.servCalls,
      note: null,
      mark: (
        <span className="dc-tile dc-tile--sm">
          <BrandLogo brand="openserv" size={16} />
        </span>
      ),
    },
    {
      label: c.stats.runs,
      value: s.openservRuns,
      note: null,
      mark: (
        <span className="dc-tile dc-tile--sm">
          <BrandLogo brand="openserv" size={16} />
        </span>
      ),
    },
  ]
  return (
    <div className="app-container">
      <header className="ov-head">
        <div>
          <p className="ov-kicker dc-hero-kicker">
            <ChainLogo chainId={4663} size={18} />
            {c.kicker}
          </p>
          <h1 className="ov-title">{c.title}</h1>
          <p className="ag-intro">{c.intro}</p>
        </div>
      </header>
      <div className="live-hero">
        <LiveBadge />
      </div>

      <section className="dc-stats" aria-label={c.meta}>
        {stats.map((x) => (
          <div key={x.label}>
            <span className="dc-stat-top">
              {x.mark}
              <span className="dc-stat-label">{x.label}</span>
            </span>
            <strong className="dc-stat-value">{x.value.toLocaleString('en-US')}</strong>
            {x.note && <span className="dc-stat-note">{x.note}</span>}
          </div>
        ))}
      </section>

      <div className="dc-live-grid">
        <section className="dc-panel" aria-labelledby="live-latest">
          <div className="dc-panel-head">
            <span className="dc-tile dc-tile--sm">
              <Receipt aria-hidden="true" />
            </span>
            <h2 id="live-latest">{c.latestTitle}</h2>
            {s.latest.length > 0 && <span className="dc-count">{s.latest.length}</span>}
          </div>
          {s.latest.length === 0 ? (
            <div className="p-4">
              <EmptyTiles
                tiles={[
                  <TokenLogo key="a" symbol="SPY" size={24} />,
                  <Fingerprint key="b" />,
                  <TokenLogo key="c" symbol="USDG" size={24} />,
                ]}
                title={c.latestNone}
              />
            </div>
          ) : (
            <ul className="dc-feed">
              {s.latest.map((t) => (
                <li key={t.txHash} className="dc-row">
                  <TxMark kind={t.kind} symbol={t.symbol} />
                  <span className="dc-row-body">
                    <span className="dc-row-title">
                      {c.kinds[t.kind] ?? t.kind}
                      {t.symbol ? ` ${t.symbol}` : ''}
                    </span>
                    <span className="dc-row-sub">
                      {t.deskSlug ? (
                        <Link href={`/agents/${t.deskSlug}` as Route}>{t.deskName}</Link>
                      ) : (
                        t.deskName
                      )}{' '}
                      · <When at={t.at} />
                    </span>
                  </span>
                  <a
                    href={`${EXPLORER}/tx/${t.txHash}`}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="dc-link"
                  >
                    {short(t.txHash, 8, 6)} <ArrowUpRight aria-hidden="true" className="size-3.5" />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="dc-side">
          <section className="dc-panel" aria-labelledby="live-revenue">
            <div className="dc-panel-head">
              <div className="min-w-0 flex-1">
                <h2 id="live-revenue">{c.revenueTitle}</h2>
                <p>{c.revenueBody}</p>
              </div>
            </div>
            <ul className="dc-kv">
              <li>
                <TokenLogo symbol="USDG" size={26} />
                <span className="dc-kv-label">{c.creators}</span>
                <span className="dc-kv-value">{usd(s.fees.creatorUsdg)}</span>
              </li>
              <li>
                <TokenLogo symbol="USDG" size={26} />
                <span className="dc-kv-label">{c.shijima}</span>
                <span className="dc-kv-value">{usd(s.fees.platformUsdg)}</span>
              </li>
            </ul>
            <p className="dc-foot">{c.copies(s.fees.copies)}</p>
          </section>

          <section className="dc-panel" aria-labelledby="live-contracts">
            <div className="dc-panel-head">
              <ChainLogo chainId={4663} size={26} />
              <h2 id="live-contracts">{c.contractsTitle}</h2>
            </div>
            <ul className="dc-kv">
              {(
                [
                  [c.factory, s.contracts.factory],
                  [c.implementation, s.contracts.implementation],
                  [c.operator, s.contracts.operator],
                ] as const
              ).map(([label, address]) => (
                <li key={address}>
                  <span className="dc-kv-label">{label}</span>
                  <a
                    href={`${EXPLORER}/address/${address}`}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="dc-link"
                  >
                    {short(address, 6, 4)} <ArrowUpRight aria-hidden="true" className="size-3.5" />
                  </a>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  )
}

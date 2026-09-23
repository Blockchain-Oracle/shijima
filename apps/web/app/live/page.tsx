import { EXPLORER } from '@desk/chain'
import { appCopy, short } from '@desk/shared'
import { ExternalLink } from 'lucide-react'
import type { Route } from 'next'
import Link from 'next/link'
import { LiveBadge } from '@/components/shell/app/LiveBadge'
import { TokenLogo } from '@/components/ui/token-logo'
import { When } from '@/components/when'
import { liveStats } from '@/lib/live.server'

export const dynamic = 'force-dynamic'
export const metadata = { title: appCopy.livePage.meta }

const usd = (raw: string) =>
  `$${(Number(raw) / 1e6).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/**
 * Live on mainnet, with the proof (PLAN-ROUND-3 D9): the block this browser reads, what the record counts, the
 * latest transactions on the explorer, the copy fees (D10) and the contracts themselves.
 */
export default async function LivePage() {
  const c = appCopy.livePage
  const s = await liveStats()
  const stats = [
    { label: c.stats.agents, value: s.agents, note: c.stats.agentsNote(s.trading) },
    { label: c.stats.followers, value: s.followers, note: null },
    { label: c.stats.trades, value: s.trades, note: c.stats.moved(usd(s.movedUsdg)) },
    { label: c.stats.checkpoints, value: s.checkpoints, note: null },
    { label: c.stats.serv, value: s.servCalls, note: null },
    { label: c.stats.runs, value: s.openservRuns, note: null },
  ]
  return (
    <div className="app-container">
      <header className="ov-head">
        <div>
          <p className="ov-kicker">{c.kicker}</p>
          <h1 className="ov-title">{c.title}</h1>
          <p className="ag-intro">{c.intro}</p>
        </div>
      </header>
      <div className="live-hero">
        <LiveBadge />
      </div>

      <section className="live-stats" aria-label={c.meta}>
        {stats.map((x) => (
          <div key={x.label} className="ov-stat">
            <span className="ov-stat-label">{x.label}</span>
            <strong className="ov-stat-value">{x.value.toLocaleString('en-US')}</strong>
            {x.note && <span className="ov-stat-note">{x.note}</span>}
          </div>
        ))}
      </section>

      <div className="ov-grid">
        <section className="ov-card" aria-labelledby="live-latest">
          <div className="ov-card-head">
            <h2 id="live-latest">{c.latestTitle}</h2>
          </div>
          {s.latest.length === 0 ? (
            <p className="ov-muted">{c.latestNone}</p>
          ) : (
            <ul className="live-txs">
              {s.latest.map((t) => (
                <li key={t.txHash}>
                  {t.symbol ? (
                    <TokenLogo symbol={t.symbol} size={22} />
                  ) : (
                    <TokenLogo symbol="CASH" size={22} />
                  )}
                  <span className="live-tx-what">
                    <strong>
                      {c.kinds[t.kind] ?? t.kind}
                      {t.symbol ? ` ${t.symbol}` : ''}
                    </strong>
                    <small>
                      {t.deskSlug ? (
                        <Link href={`/agents/${t.deskSlug}` as Route}>{t.deskName}</Link>
                      ) : (
                        t.deskName
                      )}{' '}
                      · <When at={t.at} />
                    </small>
                  </span>
                  <a
                    href={`${EXPLORER}/tx/${t.txHash}`}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="live-tx-hash"
                  >
                    {short(t.txHash, 8, 6)} <ExternalLink aria-hidden="true" className="size-3" />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="ov-side">
          <section className="ov-card" aria-labelledby="live-revenue">
            <div className="ov-card-head">
              <h2 id="live-revenue">{c.revenueTitle}</h2>
              <p>{c.revenueBody}</p>
            </div>
            <dl className="live-rows">
              <div>
                <dt>{c.creators}</dt>
                <dd>{usd(s.fees.creatorUsdg)}</dd>
              </div>
              <div>
                <dt>{c.shijima}</dt>
                <dd>{usd(s.fees.platformUsdg)}</dd>
              </div>
            </dl>
            <p className="ov-muted">{c.copies(s.fees.copies)}</p>
          </section>

          <section className="ov-card" aria-labelledby="live-contracts">
            <div className="ov-card-head">
              <h2 id="live-contracts">{c.contractsTitle}</h2>
            </div>
            <dl className="live-rows">
              {(
                [
                  [c.factory, s.contracts.factory],
                  [c.implementation, s.contracts.implementation],
                  [c.operator, s.contracts.operator],
                ] as const
              ).map(([label, address]) => (
                <div key={address}>
                  <dt>{label}</dt>
                  <dd>
                    <a href={`${EXPLORER}/address/${address}`} target="_blank" rel="noreferrer noopener">
                      {short(address, 6, 4)} <ExternalLink aria-hidden="true" className="inline size-3" />
                    </a>
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        </aside>
      </div>
    </div>
  )
}

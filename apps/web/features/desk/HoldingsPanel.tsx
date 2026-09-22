import { ago, comparedTo, deskCopy, usd } from '@desk/shared'
import type { DeskView } from '@/lib/desk.server'

const pct = (bps: number) => `${(bps / 100).toFixed(bps % 100 === 0 ? 0 : 1)}%`

/**
 * Holdings [8.9]: for each Stock Token its amount and value, its share against its target, the trading price
 * with its source and age, the reference and how far apart they are, and the flags that stop the assistant.
 */
export function Holdings({ view }: { view: DeskView }) {
  if (view.holdings.length === 0) return null
  const h = deskCopy.holdings
  const now = new Date()
  return (
    <section className="desk-panel">
      <header className="desk-panel-head">
        <h2 className="type-label-micro text-ink-muted">{h.title}</h2>
      </header>
      <div className="desk-rows">
        {view.holdings.map((row) => {
          const off = row.weightBps - row.targetBps
          const tone =
            Math.abs(off) < (view.mandate?.driftToleranceBps ?? 300)
              ? h.inLine
              : off > 0
                ? h.over(pct(off))
                : h.under(pct(-off))
          return (
            <div key={row.symbol} className="desk-holding">
              <div className="flex items-baseline justify-between gap-3">
                <span className="type-body-strong text-ink">{row.name}</span>
                <span className="type-data text-ink">
                  <span className="text-ink-muted">{row.amount} · </span>
                  {usd(BigInt(row.valueUsdg))}
                </span>
              </div>
              <div className="desk-bar" aria-hidden>
                <span className="desk-bar-fill" style={{ width: `${Math.min(100, row.weightBps / 100)}%` }} />
                <span
                  className="desk-bar-target"
                  style={{ left: `${Math.min(100, row.targetBps / 100)}%` }}
                />
              </div>
              <div className="flex items-baseline justify-between gap-3 type-caption text-ink-muted">
                <span>
                  {pct(row.weightBps)} · {h.target(pct(row.targetBps))}
                </span>
                <span>{tone}</span>
              </div>
              <p className="type-caption text-ink-secondary">
                {row.price ? h.priceNow(row.price.value, ago(new Date(row.price.at), now)) : h.noPrice}
                {row.reference
                  ? ` · ${h.referenceIs(row.reference.value, h.referenceKinds[row.reference.kind] ?? row.reference.kind)}`
                  : ''}
                {row.gapBps !== null ? ` · ${h.gap(comparedTo(row.gapBps))}` : ''}
              </p>
              <HoldingFlags flags={row.flags} owner={view.isOwner} />
            </div>
          )
        })}
      </div>
    </section>
  )
}

/**
 * What stops the assistant touching one holding, and what is coming for it [8.16]. The assistant's limits are
 * the contract's; where it cannot act, the owner still can, and the line says so.
 */
function HoldingFlags({ flags, owner }: { flags: DeskView['holdings'][number]['flags']; owner: boolean }) {
  const f = deskCopy.holdings.flags
  const lines: { text: string; warn: boolean }[] = []
  if (flags.halted === true) lines.push({ text: f.halted, warn: true })
  if (flags.halted === null) lines.push({ text: f.haltUnknown, warn: true })
  if (flags.beyondBandBps !== null)
    lines.push({ text: f.band(pct(Math.abs(flags.beyondBandBps))), warn: true })
  if (flags.feedMissing) lines.push({ text: f.feed, warn: true })
  if (flags.report) {
    const day = new Date(`${flags.report.date}T12:00:00Z`).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    })
    const when = flags.report.timing ? f.timing[flags.report.timing] : undefined
    lines.push({ text: f.report(when ? `${day}, ${when}` : day), warn: false })
  }
  if (lines.length === 0) return null
  const ownerCanSell = owner && (flags.beyondBandBps !== null || flags.feedMissing)
  return (
    <ul className="mt-1 flex flex-col gap-1">
      {lines.map((l) => (
        <li key={l.text} className={l.warn ? 'type-caption text-warning' : 'type-caption text-ink-secondary'}>
          {l.text}
        </li>
      ))}
      {ownerCanSell && <li className="type-caption text-ink-muted">{f.sellYourself}</li>}
    </ul>
  )
}

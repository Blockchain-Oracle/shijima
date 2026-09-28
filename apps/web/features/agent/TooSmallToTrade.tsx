import { MIN_TRADE_USDG } from '@desk/core'
import { appCopy } from '@desk/shared'
import { ArrowDownToLine, SlidersHorizontal } from 'lucide-react'
import type { Route } from 'next'
import Link from 'next/link'
import { TokenStack } from '@/components/ui/token-logo'
import type { DeskView } from '@/lib/desk.server'

const c = appCopy.agentPage.tooSmall
export const dollars = (raw: bigint) =>
  `$${(Number(raw) / 1e6).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/**
 * Whether the agent holds cash it can never spend: every buy its plan asks for is under the smallest trade. Null
 * when it can trade (or is not running). The status card and the owner's warning both read this one answer.
 */
export function stuckOf(view: DeskView) {
  const plate = view.plate
  const m = view.mandate
  if (!plate || !m || view.desk.lifecycle !== 'running') return null
  const total = BigInt(plate.totalUsdg)
  const cash = BigInt(plate.cashUsdg)
  if (cash <= 0n) return null
  const short = view.holdings
    .map((h) => ({ symbol: h.symbol, need: (total * BigInt(h.targetBps)) / 10_000n - BigInt(h.valueUsdg) }))
    .filter((h) => h.need > 0n)
  const behind = view.holdings.filter((h) => h.targetBps - h.weightBps > m.driftToleranceBps)
  if (behind.length === 0 || short.some((h) => h.need >= MIN_TRADE_USDG)) return null
  const smallest = Math.min(...behind.map((h) => h.targetBps))
  const enough = (MIN_TRADE_USDG * 10_000n + BigInt(smallest) - 1n) / BigInt(smallest)
  const largest = short.reduce((a, h) => (h.need > a ? h.need : a), 0n)
  return { cash, more: enough > total ? enough - total : 0n, behind, largest }
}

/**
 * What the owner needs to know when the agent holds cash it can never spend, so each check says "nothing to do"
 * and the agent looks alive while doing nothing. Says it plainly, draws the largest buy against the smallest
 * trade (21st's Progress With Value, 19174), and gives the two ways out.
 */
export function TooSmallToTrade({ view }: { view: DeskView }) {
  const stuck = view.isOwner ? stuckOf(view) : null
  if (!stuck) return null
  const fill = Math.max(4, Math.min(100, Number((stuck.largest * 100n) / MIN_TRADE_USDG)))
  return (
    <section className="ap-stuck" role="status">
      <TokenStack symbols={stuck.behind.map((h) => h.symbol)} max={4} size={26} />
      <div className="ap-stuck-text">
        <b>{c.title}</b>
        <p>{c.body(dollars(stuck.cash), dollars(stuck.more))}</p>
        <div className="ap-stuck-meter">
          <span className="ap-stuck-bar" aria-hidden="true">
            <span style={{ width: `${fill}%` }} />
          </span>
          <small className="ap-stuck-note">{c.meter(dollars(stuck.largest), dollars(MIN_TRADE_USDG))}</small>
        </div>
      </div>
      <div className="ap-stuck-actions">
        <Link href={`/fund?agent=${view.slug}` as Route} className="ap-chip-btn ap-chip-btn--primary">
          <ArrowDownToLine aria-hidden="true" className="size-3.5" />
          {c.add(dollars(stuck.more))}
        </Link>
        <Link href={`/agents/${view.slug}/settings#plan` as Route} className="ap-chip-btn">
          <SlidersHorizontal aria-hidden="true" className="size-3.5" />
          {c.plan}
        </Link>
      </div>
    </section>
  )
}

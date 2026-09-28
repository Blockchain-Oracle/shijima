import { MIN_TRADE_USDG } from '@desk/core'
import { appCopy } from '@desk/shared'
import { ArrowDownToLine, SlidersHorizontal } from 'lucide-react'
import type { Route } from 'next'
import Link from 'next/link'
import { TokenStack } from '@/components/ui/token-logo'
import type { DeskView } from '@/lib/desk.server'

const c = appCopy.agentPage.tooSmall
const dollars = (raw: bigint) =>
  `$${(Number(raw) / 1e6).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/**
 * What the owner needs to know when the agent holds cash it can never spend: every buy its plan asks for is under
 * the smallest trade, so each check says "nothing to do" and the agent looks alive while doing nothing. Says it
 * plainly, with how much more would do, and the two ways out.
 */
export function TooSmallToTrade({ view }: { view: DeskView }) {
  const plate = view.plate
  const m = view.mandate
  if (!view.isOwner || !plate || !m || view.desk.lifecycle !== 'running') return null
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
  const more = enough > total ? enough - total : 0n
  return (
    <section className="ap-stuck" role="status">
      <TokenStack symbols={behind.map((h) => h.symbol)} max={4} size={26} />
      <div className="ap-stuck-text">
        <b>{c.title}</b>
        <p>{c.body(dollars(cash), dollars(more))}</p>
      </div>
      <div className="ap-stuck-actions">
        <Link href={`/fund?agent=${view.slug}` as Route} className="ap-chip-btn ap-chip-btn--primary">
          <ArrowDownToLine aria-hidden="true" className="size-3.5" />
          {c.add(dollars(more))}
        </Link>
        <Link href={`/agents/${view.slug}/settings#plan` as Route} className="ap-chip-btn">
          <SlidersHorizontal aria-hidden="true" className="size-3.5" />
          {c.plan}
        </Link>
      </div>
    </section>
  )
}

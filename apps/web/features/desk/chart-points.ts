/**
 * The agent's value history as chart points, with the owner's own money moves on them: each point carries money
 * in minus out so far, so the chart reads change NET of it, and each move is a marker ("You took out $2").
 */
import { moneyCopy, usd } from '@desk/shared'
import type { DeskView } from '@/lib/desk.server'
import { moneyChain } from '@/lib/money/chains'
import type { ChartMarker, ValuePoint } from './PortfolioChart'

type HistoryRow = { at: string; totalUsdg: string; flowsUsdg?: string }

const toPoint =
  (earlier: boolean) =>
  (h: HistoryRow): ValuePoint => ({
    t: new Date(h.at).getTime(),
    value: Number(h.totalUsdg) / 1e6,
    ...(h.flowsUsdg !== undefined ? { flow: Number(h.flowsUsdg) / 1e6 } : {}),
    ...(earlier ? { earlier: true } : {}),
  })

/** The earlier contract's history, then this one's. */
export function chartPoints(view: Pick<DeskView, 'history' | 'earlier'>): ValuePoint[] {
  return [...(view.earlier?.history.map(toPoint(true)) ?? []), ...view.history.map(toPoint(false))]
}

/** One marker per check that found money arriving or leaving. */
export function flowMarkers(view: Pick<DeskView, 'flows'>): ChartMarker[] {
  return view.flows.flatMap((f) => {
    const amount = BigInt(f.usdg)
    if (amount === 0n) return []
    const dollars = usd(amount < 0n ? -amount : amount)
    const from = f.fromChainId && f.fromChainId !== 4663 ? moneyChain(f.fromChainId)?.name : undefined
    return [
      {
        t: new Date(f.at).getTime(),
        kind: amount > 0n ? ('in' as const) : ('out' as const),
        label:
          amount < 0n
            ? moneyCopy.chart.tookOut(dollars)
            : from
              ? moneyCopy.chart.addedFrom(dollars, from)
              : moneyCopy.chart.added(dollars),
      },
    ]
  })
}

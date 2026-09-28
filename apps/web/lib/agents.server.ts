/**
 * The public face of every shared agent, for the Live agents board and the landing page's carousel: what it holds
 * and how that moved, its latest real decision in its own words, its graded track record, and a small line of its
 * value. Only agents whose owners turned sharing on; never an owner's address in full, never their notes.
 */
import { APPROVED_TOKENS } from '@desk/chain'
import {
  currentMandate,
  deskById,
  deskRecord,
  followersOf,
  gradeTally,
  isQuiet,
  latestValueSnapshot,
  mandateFromRow,
  sharedDesks,
  valueHistory,
  valueSnapshotAtOrBefore,
} from '@desk/db'
import { db } from './db'
import { netChangeBps, netSeries } from './money/flows'

const DAY_MS = 24 * 60 * 60 * 1000

const symbolOf = (address: string | null) =>
  address
    ? (APPROVED_TOKENS.find((t) => t.address.toLowerCase() === address.toLowerCase())?.symbol ?? null)
    : null

export interface PublicAgent {
  id: string
  slug: string
  name: string
  mode: 'shadow' | 'ask_first' | 'on_its_own'
  running: boolean
  symbols: string[]
  valueUsdg: string | null
  dayBps: number | null
  latest: {
    seq: number
    summary: string
    outcome: string
    shadow: boolean
    symbol: string | null
    at: string
  } | null
  graded: number
  better: number
  followers: number
  /** The last two days of value, thinned to about 32 points, in dollars. */
  spark: number[]
  startedAt: string | null
  /** The basket, heaviest first, and the share kept as cash: the card's donut. */
  weights: { symbol: string; weightBps: number }[]
  cashBps: number
  /** Whether its owner lets others copy it, and the one-time fee in USDG base units. */
  copyable: boolean
  copyFeeUsdg: string
}

export async function publicAgents(): Promise<PublicAgent[]> {
  const shared = (await sharedDesks(db())).filter((d) => d.lifecycle !== 'closed' && d.shareSlug)
  const rows = await Promise.all(
    shared.map(async (d): Promise<PublicAgent> => {
      const [now, dayAgo, mandateRow, record, tally, history, followers, full] = await Promise.all([
        latestValueSnapshot(db(), d.id),
        valueSnapshotAtOrBefore(db(), d.id, new Date(Date.now() - DAY_MS)),
        currentMandate(db(), d.id),
        deskRecord(db(), d.id, { limit: 40 }),
        gradeTally(db(), d.id),
        valueHistory(db(), d.id, 200),
        followersOf(db(), d.id),
        deskById(db(), d.id),
      ])
      const mandate = mandateRow ? mandateFromRow(mandateRow) : null
      const latest = record.find((r) => !isQuiet(r)) ?? record[0]
      const recent = history.filter((h) => h.takenAt.getTime() > Date.now() - 2 * DAY_MS)
      const step = Math.max(1, Math.ceil(recent.length / 32))
      return {
        id: d.id,
        slug: d.shareSlug ?? d.id,
        name: d.name ?? 'Agent',
        mode: d.mode,
        running: d.lifecycle === 'running' && d.state === 'active',
        symbols: (mandate?.targets.tokens ?? [])
          .slice()
          .sort((a, b) => b.weightBps - a.weightBps)
          .flatMap((t) => symbolOf(t.token) ?? []),
        valueUsdg: now ? now.totalUsdg.toString() : null,
        dayBps: now && dayAgo ? netChangeBps(now, dayAgo) : null,
        latest: latest
          ? {
              seq: latest.seq,
              summary: latest.summary,
              outcome: latest.outcome,
              shadow: latest.shadow,
              symbol: symbolOf(latest.token),
              at: latest.decidedAt.toISOString(),
            }
          : null,
        graded: tally.graded,
        better: tally.better,
        followers: followers.filter((f) => f.link.status !== 'stopped').length,
        spark: netSeries(recent.filter((_, i) => i % step === 0)),
        startedAt: d.startedAt?.toISOString() ?? null,
        weights: (mandate?.targets.tokens ?? [])
          .slice()
          .sort((a, b) => b.weightBps - a.weightBps)
          .flatMap((t) => {
            const symbol = symbolOf(t.token)
            return symbol ? [{ symbol, weightBps: t.weightBps }] : []
          }),
        cashBps: mandate?.targets.cashBps ?? 10_000,
        copyable: full?.copyable ?? false,
        copyFeeUsdg: (full?.copyFeeUsdg ?? 0n).toString(),
      }
    }),
  )
  // Live agents first, then by what they hold: the board leads with agents trading real money.
  return rows.sort(
    (a, b) =>
      Number(b.mode !== 'shadow') - Number(a.mode !== 'shadow') ||
      Number(BigInt(b.valueUsdg ?? '0') - BigInt(a.valueUsdg ?? '0')),
  )
}

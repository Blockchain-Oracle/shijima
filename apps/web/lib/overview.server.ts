/**
 * The owner's Overview: every open agent at once. What they hold together and how that moved, what waits on the
 * owner, each agent's latest real decision, and whether Telegram and OpenServ are connected. Read from Postgres
 * only, like the shell, so the page needs no chain call and no key.
 */
import { APPROVED_TOKENS } from '@desk/chain'
import {
  currentMandate,
  deskRecord,
  desksOfOwner,
  isQuiet,
  latestValueSnapshot,
  mandateFromRow,
  openservForDesk,
  pendingApprovals,
  telegramForDesk,
  valueHistory,
  valueSnapshotAtOrBefore,
} from '@desk/db'
import { db } from './db'
import { netChangeBps, netChangeUsdg } from './money/flows'

const DAY_MS = 24 * 60 * 60 * 1000
const HOUR_MS = 60 * 60 * 1000

const symbolOf = (address: string | null) =>
  address
    ? (APPROVED_TOKENS.find((t) => t.address.toLowerCase() === address.toLowerCase())?.symbol ?? null)
    : null

export interface OverviewAgent {
  id: string
  slug: string
  name: string
  mode: 'shadow' | 'ask_first' | 'on_its_own'
  state: string
  symbols: string[]
  valueUsdg: string | null
  changeBps: number | null
  needsYou: number
  latest: {
    seq: number
    summary: string
    outcome: string
    shadow: boolean
    symbol: string | null
    at: string
  } | null
}

export interface OverviewNeed {
  agentName: string
  agentSlug: string
  seq: number
  summary: string
  createdAt: string
}

export interface Overview {
  agents: OverviewAgent[]
  totalUsdg: string | null
  dayChangeUsdg: string | null
  /**
   * Every agent's value added up, hour by hour, oldest first, in dollars, with money in minus out so far (`flow`),
   * so the chart reads the change net of the owner's own moves.
   */
  combined: { t: number; value: number; flow: number }[]
  needs: OverviewNeed[]
  telegramLinked: number
  openservLinked: number
}

export async function loadOverview(address: string): Promise<Overview> {
  const desks = (await desksOfOwner(db(), address)).filter((d) => d.lifecycle !== 'closed')

  const rows = await Promise.all(
    desks.map(async (d) => {
      const [now, dayAgo, mandateRow, waiting, record, history, telegram, openserv] = await Promise.all([
        latestValueSnapshot(db(), d.id),
        valueSnapshotAtOrBefore(db(), d.id, new Date(Date.now() - DAY_MS)),
        currentMandate(db(), d.id),
        pendingApprovals(db(), d.id),
        deskRecord(db(), d.id, { limit: 40 }),
        valueHistory(db(), d.id, 400),
        telegramForDesk(db(), d.id),
        openservForDesk(db(), d.id),
      ])
      const mandate = mandateRow ? mandateFromRow(mandateRow) : null
      // The latest decision worth reading: a quiet check that only held an earlier call is not news.
      const latest = record.find((r) => !isQuiet(r)) ?? record[0]
      const agent: OverviewAgent = {
        id: d.id,
        slug: d.shareSlug ?? d.id,
        name: d.name ?? 'Agent',
        mode: d.mode,
        state: d.state,
        symbols: (mandate?.targets.tokens ?? [])
          .slice()
          .sort((a, b) => b.weightBps - a.weightBps)
          .flatMap((t) => symbolOf(t.token) ?? []),
        valueUsdg: now ? now.totalUsdg.toString() : null,
        // Net of money the owner moved: a withdrawal is not a loss.
        changeBps: now && dayAgo ? netChangeBps(now, dayAgo) : null,
        needsYou: waiting.length,
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
      }
      const needs: OverviewNeed[] = waiting.map((w) => ({
        agentName: agent.name,
        agentSlug: agent.slug,
        seq: w.decisionSeq,
        summary: w.summary,
        createdAt: w.createdAt.toISOString(),
      }))
      return {
        agent,
        needs,
        now,
        dayAgo,
        history,
        telegram: telegram.linked !== null,
        openserv: openserv.linked.length > 0,
      }
    }),
  )

  const valued = rows.filter((r) => r.now)
  const total = valued.length > 0 ? valued.reduce((s, r) => s + (r.now?.totalUsdg ?? 0n), 0n) : null
  const withDay = valued.filter((r) => r.dayAgo)
  const dayChange =
    withDay.length > 0
      ? withDay.reduce((s, r) => s + (r.now && r.dayAgo ? netChangeUsdg(r.now, r.dayAgo) : 0n), 0n)
      : null

  return {
    agents: rows.map((r) => r.agent),
    totalUsdg: total === null ? null : total.toString(),
    dayChangeUsdg: dayChange === null ? null : dayChange.toString(),
    combined: combine(rows.map((r) => r.history)),
    needs: rows.flatMap((r) => r.needs).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    telegramLinked: rows.filter((r) => r.telegram).length,
    openservLinked: rows.filter((r) => r.openserv).length,
  }
}

/**
 * Adds several agents' value histories into one line, an hour at a time. Each agent carries its last known value
 * forward, and an hour counts only once every agent has started, so a new agent never shows as a jump in value.
 */
function combine(
  histories: { takenAt: Date; totalUsdg: bigint; flowsUsdg: bigint }[][],
): { t: number; value: number; flow: number }[] {
  const live = histories.filter((h) => h.length > 0)
  if (live.length === 0) return []
  const start = Math.max(...live.map((h) => h[0]?.takenAt.getTime() ?? 0))
  const end = Math.max(...live.map((h) => h[h.length - 1]?.takenAt.getTime() ?? 0))
  const out: { t: number; value: number; flow: number }[] = []
  const cursor = live.map(() => 0)
  for (let t = Math.floor(start / HOUR_MS) * HOUR_MS; t <= end + HOUR_MS; t += HOUR_MS) {
    let sum = 0n
    let flows = 0n
    for (const [i, h] of live.entries()) {
      let at = cursor[i] ?? 0
      while (at + 1 < h.length && (h[at + 1]?.takenAt.getTime() ?? Infinity) <= t) at++
      cursor[i] = at
      sum += h[at]?.totalUsdg ?? 0n
      flows += h[at]?.flowsUsdg ?? 0n
    }
    out.push({ t, value: Number(sum) / 1e6, flow: Number(flows) / 1e6 })
  }
  return out
}

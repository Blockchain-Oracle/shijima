/**
 * The Wallet page's numbers: the owner's own wallet and every open agent, read from the CHAIN at the moment of
 * asking ("checked just now"), plus the activity feed (decisions and money moves, newest first).
 *
 * Nothing is cached across requests: the numbers are one person's and must be the chain's. Prices are what a sale
 * would give now on each stock's own pool; ETH is on the ETH/USD feed. The agent's change over a day is net of the
 * owner's own money moving in and out, so a withdrawal never reads as a loss.
 */
import {
  APPROVED_TOKENS,
  type DeskWalletReading,
  readDeskWallet,
  readWallet,
  type WalletHolding,
  type WalletReading,
} from '@desk/chain'
import {
  currentMandate,
  deskRecord,
  desksOfOwner,
  isQuiet,
  latestDecisionOf,
  latestValueSnapshot,
  type MoneyMoveStatus,
  moneyMovesOfOwner,
  pendingApprovals,
  valueSnapshotAtOrBefore,
} from '@desk/db'
import { moneyCopy } from '@desk/shared'
import type { Address } from 'viem'
import { pub } from './chain-build.server'
import { db } from './db'
import { txUrl } from './money/chains'
import { netChangeBps } from './money/flows'
import { relayRequestUrl } from './money/relay.server'

const DAY_MS = 24 * 60 * 60 * 1000

const symbolOf = (address: string | null) =>
  address
    ? (APPROVED_TOKENS.find((t) => t.address.toLowerCase() === address.toLowerCase())?.symbol ?? null)
    : null

export type { WalletHolding, WalletReading }

export interface WalletAgent {
  id: string
  /** The share slug when there is one, else the id: what `/agents/[slug]` takes. */
  slug: string
  name: string
  mode: 'shadow' | 'ask_first' | 'on_its_own'
  state: string
  address: Address
  /** From the chain now. All USDG raw units (6 decimals). */
  cashUsdg: bigint
  savingsUsdg: bigint
  stocks: WalletHolding[]
  totalUsdg: bigint
  /** The Stock Tokens its mandate names, largest target first. */
  symbols: string[]
  /** The last day's change, net of money in and out, in basis points. Null without a day of history. */
  changeBps: number | null
  needsYou: number
  latest: {
    seq: number
    summary: string
    outcome: string
    shadow: boolean
    symbol: string | null
    at: Date
  } | null
  /** When the chain was read for this agent; null when the read failed and the numbers are the last snapshot's. */
  checkedAt: Date | null
  /** Symbols held that could not be priced this time. */
  unpriced: string[]
}

export interface Wallet {
  /** The owner's own wallet, or null when the chain could not be read. */
  wallet: WalletReading | null
  agents: WalletAgent[]
  agentsTotalUsdg: bigint
  readAt: Date
  unpriced: string[]
}

/** One agent: its money from the chain, and its day, its requests and its latest decision from the database. */
async function loadAgent(d: Awaited<ReturnType<typeof desksOfOwner>>[number]): Promise<WalletAgent> {
  const [chain, now, dayAgo, mandateRow, waiting, record, decision] = await Promise.all([
    readDeskWallet(pub(), d.address as Address).catch((): DeskWalletReading | null => null),
    latestValueSnapshot(db(), d.id),
    valueSnapshotAtOrBefore(db(), d.id, new Date(Date.now() - DAY_MS)),
    currentMandate(db(), d.id),
    pendingApprovals(db(), d.id),
    deskRecord(db(), d.id, { limit: 40 }),
    latestDecisionOf(db(), d.id),
  ])
  const latest = decision ?? record[0]
  const targets = (mandateRow?.targets as { tokens?: { token: string; weightBps: number }[] } | undefined)
    ?.tokens
  return {
    id: d.id,
    slug: d.shareSlug ?? d.id,
    name: d.name ?? 'Agent',
    mode: d.mode,
    state: d.state,
    address: d.address as Address,
    cashUsdg: chain?.cashUsdg ?? now?.cashUsdg ?? 0n,
    savingsUsdg: chain?.savingsUsdg ?? now?.vaultUsdg ?? 0n,
    stocks: chain?.stocks ?? [],
    totalUsdg: chain?.totalUsdg ?? now?.totalUsdg ?? 0n,
    symbols: (targets ?? [])
      .slice()
      .sort((a, b) => b.weightBps - a.weightBps)
      .flatMap((t) => symbolOf(t.token) ?? []),
    changeBps: now && dayAgo ? netChangeBps(now, dayAgo) : null,
    needsYou: waiting.length,
    latest: latest
      ? {
          seq: latest.seq,
          summary: latest.summary,
          outcome: latest.outcome,
          shadow: latest.shadow,
          symbol: symbolOf(latest.token),
          at: latest.decidedAt,
        }
      : null,
    checkedAt: chain?.readAt ?? null,
    unpriced: chain?.unpriced ?? [],
  }
}

/** The owner's wallet and every open agent, from the chain now. */
export async function loadWallet(owner: string): Promise<Wallet> {
  const desks = (await desksOfOwner(db(), owner)).filter((d) => d.lifecycle !== 'closed')
  const [wallet, agents] = await Promise.all([
    readWallet(pub(), owner as Address).catch(() => null),
    Promise.all(desks.map(loadAgent)),
  ])
  return {
    wallet,
    agents,
    agentsTotalUsdg: agents.reduce((s, a) => s + a.totalUsdg, 0n),
    readAt: new Date(),
    unpriced: [...new Set([...(wallet?.unpriced ?? []), ...agents.flatMap((a) => a.unpriced)])],
  }
}

// ---------------------------------------------------------------- activity

export type ActivityStatus = 'pending' | 'done' | 'failed' | 'onItsWay' | 'maybeSent'

export interface ActivityItem {
  kind: 'decision' | 'move'
  /** The decision's own words, or what the move was: "Add money · Shijima's own". */
  title: string
  /** A second line: the outcome, or where the money went. */
  detail: string
  amountUsdg: bigint | null
  status: ActivityStatus
  txHash: string | null
  /** Where to read more: the decision page, or the transaction on its explorer (Relay's page for a bridge). */
  href: string | null
  at: Date
  agentName: string | null
  /** For a move: which of the kinds it was. For a decision: its outcome. */
  subkind: string
  /** The Stock Token a decision was about, when it named one: its logo leads the row. */
  symbol: string | null
  /** A move's chains, from and to, so the row wears their logos. */
  chains: [number, number] | null
}

const MOVE_STATUS: Record<MoneyMoveStatus, ActivityStatus> = {
  signing: 'pending',
  approved_only: 'failed',
  nothing_sent: 'failed',
  on_its_way: 'onItsWay',
  done: 'done',
  may_have_been_sent: 'maybeSent',
}

const DECISION_STATUS: Record<string, ActivityStatus> = {
  asked: 'pending',
  failed: 'failed',
  blocked_by_limit: 'failed',
  not_executed: 'failed',
}

const CHAIN_NAMES: Record<number, string> = {
  4663: 'Robinhood Chain',
  8453: 'Base',
  42161: 'Arbitrum',
  1: 'Ethereum',
  56: 'BNB Chain',
}

/** What the owner's agents decided and what money the owner moved, newest first. Quiet checks are left out. */
export async function recentActivity(owner: string, limit = 30): Promise<ActivityItem[]> {
  const desks = await desksOfOwner(db(), owner)
  const [records, moves] = await Promise.all([
    Promise.all(desks.map((d) => deskRecord(db(), d.id, { limit }).then((rows) => ({ d, rows })))),
    moneyMovesOfOwner(db(), owner, limit),
  ])
  const decisions: ActivityItem[] = records.flatMap(({ d, rows }) =>
    rows
      .filter((r) => !isQuiet(r))
      .map((r) => ({
        kind: 'decision' as const,
        title: r.summary,
        detail: r.shadow ? `${r.outcome.replaceAll('_', ' ')} · practice` : r.outcome.replaceAll('_', ' '),
        amountUsdg: r.amountUsdg,
        status: DECISION_STATUS[r.outcome] ?? 'done',
        txHash: r.sealedByTx,
        href: `/agents/${d.shareSlug ?? d.id}/decision/${r.seq}`,
        at: r.decidedAt,
        agentName: d.name ?? 'Agent',
        subkind: r.outcome,
        symbol: r.token
          ? (APPROVED_TOKENS.find((t) => t.address.toLowerCase() === r.token?.toLowerCase())?.symbol ?? null)
          : null,
        chains: null,
      })),
  )
  const money: ActivityItem[] = moves
    // A plan nobody signed moved nothing and says nothing.
    .filter(({ move }) => !(move.status === 'signing' && move.txHashes.length === 0))
    .filter(({ move }) => !(move.status === 'nothing_sent' && move.txHashes.length === 0))
    .map(({ move, deskName }) => {
      const hash = move.txHashes.at(-1) ?? null
      const route =
        move.fromChainId === move.toChainId
          ? (CHAIN_NAMES[move.fromChainId] ?? `chain ${move.fromChainId}`)
          : `${CHAIN_NAMES[move.fromChainId] ?? move.fromChainId} → ${CHAIN_NAMES[move.toChainId] ?? move.toChainId}`
      return {
        kind: 'move' as const,
        title: deskName ? `${moneyCopy.kinds[move.kind]} · ${deskName}` : moneyCopy.kinds[move.kind],
        detail: route,
        amountUsdg: move.usdgValue,
        status: MOVE_STATUS[move.status],
        txHash: hash,
        href: move.relayRequestId
          ? relayRequestUrl(move.relayRequestId)
          : hash
            ? txUrl(move.fromChainId, hash)
            : null,
        at: move.createdAt,
        agentName: deskName,
        subkind: move.kind,
        symbol: null,
        chains: [move.fromChainId, move.toChainId] as [number, number],
      }
    })
  return [...decisions, ...money].sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, limit)
}

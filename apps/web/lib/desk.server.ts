/**
 * Everything one desk's page shows, read on the server from Postgres. The owner gets the whole desk and the
 * chat. A visitor gets the same page read-only, and only when the owner turned sharing on. Nothing here reads
 * the chain or holds a key.
 */
import { APPROVED_TOKENS, fetchVaultRate } from '@desk/chain'
import { previousWindow, reportWindow } from '@desk/core'
import {
  ASSISTANT_REMOVED,
  askHistory,
  companyEventsFrom,
  currentMandate,
  deskById,
  deskIdBySlug,
  deskNotes,
  deskRecord,
  GO_LIVE_CHECKS,
  groupQuietRuns,
  lastCheckOf,
  latestPricePoints,
  latestValueSnapshot,
  mandateFromRow,
  outcomeCounts,
  pendingApprovals,
  predecessorOf,
  pricesBetween,
  spentSince,
  standingWaits,
  telegramForDesk,
  timingSummary,
  valueHistory,
  valueSnapshotAtOrBefore,
} from '@desk/db'
import { PRESETS, price, tokens as tokenAmount } from '@desk/shared'
import { type ChatTurn, toChatTurn } from '@/features/desk/chat-model'
import { db } from './db'
import { signedInAddress } from './session'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
/** The desk's fee, from the design brief: 0.5% a year of what it holds, shown accruing, waived in the beta. */
const FEE_BPS_A_YEAR = 50n

/** A token's status is shown only from a price-log row this fresh; an older one would be a guess. */
const FLAGS_FRESH_MS = 60 * 60 * 1000
/** A report this close is worth a line on the holding. */
const REPORT_DAYS = 7
/** Desk.sol refuses the assistant's trades beyond this distance from the last official update. */
const BAND_BPS = 800

const nameOf = (address: string) =>
  APPROVED_TOKENS.find((t) => t.address.toLowerCase() === address.toLowerCase())

/**
 * The savings vault's rate, from Morpho's public API, read at most every ten minutes and only for a desk with
 * money in the vault. One attempt: a page never waits on a slow API, it simply shows no rate.
 */
let vaultRate: { at: number; bps: number | null } | undefined
export async function currentVaultRateBps(): Promise<number | null> {
  if (vaultRate && Date.now() - vaultRate.at < 10 * 60 * 1000) return vaultRate.bps
  const rate = await fetchVaultRate(1)
  vaultRate = { at: Date.now(), bps: rate?.netApyBps ?? null }
  return vaultRate.bps
}

/**
 * Who may see the desk a slug names, and how. The owner reaches their desk by its id or its share slug whether
 * sharing is on or not. Anyone else sees it only through the share link, and only while sharing is on. Every
 * desk page resolves through here, so an owner is never locked out of their own record, report or decisions.
 */
export async function deskForViewer(slug: string) {
  const viewer = await signedInAddress().catch(() => undefined)
  const id = UUID.test(slug) ? slug : await deskIdBySlug(db(), slug)
  if (!id) return undefined
  const desk = await deskById(db(), id)
  if (!desk) return undefined
  const isOwner = viewer !== undefined && viewer.toLowerCase() === desk.ownerAddress.toLowerCase()
  if (!isOwner && !(desk.shareEnabled && desk.shareSlug === slug)) return undefined
  return {
    isOwner,
    slug,
    /** The public face: what a visitor's page may show. No owner address, no Telegram, no notes. */
    face: {
      id: desk.id,
      name: desk.name ?? 'Your agent',
      address: desk.address,
      chainId: desk.chainId,
      contractVersion: desk.contractVersion,
      mode: desk.mode,
      state: desk.state,
      stateReason: desk.stateReason,
      lifecycle: desk.lifecycle,
      shareSlug: desk.shareEnabled ? desk.shareSlug : null,
      startedAt: desk.startedAt,
      shadowChecks: desk.shadowChecks,
      shadowReportOpenedAt: desk.shadowReportOpenedAt,
      chainSeq: desk.chainSeq,
    },
    /** The whole row, for server code only. Never hand this to a client component or a visitor's page. */
    raw: desk,
  }
}

export type ViewerDesk = NonNullable<Awaited<ReturnType<typeof deskForViewer>>>

export async function loadDesk(slug: string) {
  const resolved = await deskForViewer(slug)
  if (!resolved) return undefined
  const { isOwner, raw: desk } = resolved

  const [snapshot, mandateRow, approvals, record, history, timing, chat] = await Promise.all([
    latestValueSnapshot(db(), desk.id),
    currentMandate(db(), desk.id),
    isOwner ? pendingApprovals(db(), desk.id) : Promise.resolve([]),
    deskRecord(db(), desk.id, { limit: 60 }),
    valueHistory(db(), desk.id, 400),
    timingSummary(db(), desk.id),
    isOwner ? askHistory(db(), desk.id, desk.ownerAddress) : Promise.resolve([]),
  ])
  const mandate = mandateRow ? mandateFromRow(mandateRow) : null
  const tokens = mandate?.targets.tokens.map((t) => t.token) ?? []
  const today = new Date().toISOString().slice(0, 10)
  const now = new Date()
  // The last reopen: this stretch's, if the market is open, otherwise the one before this close.
  const stretch = reportWindow(now)
  const reopenedAt = stretch.settled ? stretch.to : previousWindow(stretch).to
  const earlierDesk = await predecessorOf(db(), desk.address)
  const [earlierHistory, earlierRecord, dayPrices] = await Promise.all([
    earlierDesk ? valueHistory(db(), earlierDesk.id, 400) : Promise.resolve([]),
    earlierDesk ? deskRecord(db(), earlierDesk.id, { limit: 200 }) : Promise.resolve([]),
    tokens.length > 0
      ? pricesBetween(db(), new Date(Date.now() - 24 * 60 * 60 * 1000), new Date())
      : Promise.resolve([]),
  ])
  // A day of each held token's pool price, thinned to about 24 points, for the holdings' sparklines.
  const sparkOf = (token: string) => {
    const rows = dayPrices.filter(
      (r) => r.token.toLowerCase() === token.toLowerCase() && r.poolMidE8 !== null,
    )
    const step = Math.max(1, Math.ceil(rows.length / 24))
    return rows
      .filter((_, i) => i % step === 0 || i === rows.length - 1)
      .map((r) => Number(r.poolMidE8) / 1e8)
  }
  const [lastCheck, notes, prices, events, spentToday, atReopen, telegram, waits, counts] = await Promise.all(
    [
      lastCheckOf(db(), desk.id),
      deskNotes(db(), desk.id, desk.startedAt ?? desk.createdAt, tokens),
      latestPricePoints(db()),
      tokens.length > 0 ? companyEventsFrom(db(), today, tokens) : Promise.resolve([]),
      spentSince(db(), desk.id, new Date(now.getTime() - 24 * 60 * 60 * 1000)),
      valueSnapshotAtOrBefore(db(), desk.id, reopenedAt),
      isOwner ? telegramForDesk(db(), desk.id) : Promise.resolve(null),
      standingWaits(db(), desk.id),
      outcomeCounts(db(), desk.id),
    ],
  )
  const priceOf = new Map(prices.map((p) => [p.token.toLowerCase(), p]))
  const reportOf = (token: string) => {
    const e = events.find((x) => x.token.toLowerCase() === token.toLowerCase() && x.kind === 'earnings')
    if (!e) return null
    const days = (new Date(`${e.eventDate}T12:00:00Z`).getTime() - Date.now()) / 86_400_000
    return days <= REPORT_DAYS ? { date: e.eventDate, timing: e.timing } : null
  }

  const total = snapshot?.totalUsdg ?? null
  const share = (v: bigint) => (total && total > 0n ? Number((v * 10_000n) / total) : 0)
  const holdings = mandate
    ? mandate.targets.tokens.map((t) => {
        const held = snapshot?.holdings.find((h) => h.token.toLowerCase() === t.token.toLowerCase())
        const token = nameOf(t.token)
        const value = held ? BigInt(held.valueUsdg) : 0n
        const p = priceOf.get(t.token.toLowerCase())
        const fresh = p !== undefined && Date.now() - p.at.getTime() < FLAGS_FRESH_MS
        // The contract's band is measured against the feed: the snapshot's own gap if it has one, else the log's.
        const bandBps =
          held?.gapToFeedBps ??
          (fresh && p.twap30E8 && p.feedPriceE8 && p.feedPriceE8 > 0n
            ? Number(((p.twap30E8 - p.feedPriceE8) * 10_000n) / p.feedPriceE8)
            : null)
        return {
          symbol: token?.symbol ?? t.token,
          name: token?.displayName ?? t.token,
          amount: held ? tokenAmount(BigInt(held.amountRaw)) : '0',
          valueUsdg: value.toString(),
          weightBps: share(value),
          targetBps: t.weightBps,
          // The price with its source and age, and the reference it is measured against [8.9, section 10].
          price: p?.poolMidE8 ? { value: price(p.poolMidE8), at: p.at.toISOString() } : null,
          reference:
            p?.referenceE8 && p.referenceKind
              ? {
                  value: price(p.referenceE8),
                  kind: p.referenceKind,
                  at: p.referenceAt?.toISOString() ?? null,
                }
              : null,
          gapBps: p?.gapBps ?? null,
          gapToFeedBps: held?.gapToFeedBps ?? null,
          spark: sparkOf(t.token),
          flags: {
            halted: fresh ? p.halted : false,
            feedMissing: fresh ? p.feedPriceE8 === null || p.oraclePaused === true : false,
            beyondBandBps: bandBps !== null && Math.abs(bandBps) >= BAND_BPS ? bandBps : null,
            report: reportOf(t.token),
          },
        }
      })
    : []

  const turns: ChatTurn[] = chat.map((row) =>
    toChatTurn(
      row,
      row.proposalId && row.proposalKind && row.proposalPath && row.proposalStatus && row.proposalExpiresAt
        ? {
            id: row.proposalId,
            kind: row.proposalKind,
            path: row.proposalPath,
            status: row.proposalStatus,
            deskView: row.proposalView ?? {},
            expiresAt: row.proposalExpiresAt,
            result: row.proposalResult ?? null,
            txHash: row.proposalTxHash,
          }
        : null,
    ),
  )

  // The fee accrues only on real money: nothing in practice. It is shown, and waived.
  const liveDays =
    desk.mode === 'shadow' || !desk.startedAt ? 0 : (Date.now() - desk.startedAt.getTime()) / 86_400_000
  const feeUsdg =
    total === null || liveDays === 0
      ? 0n
      : (total * FEE_BPS_A_YEAR * BigInt(Math.round(liveDays * 1000))) / (10_000n * 365_000n)

  const lossStop =
    mandate && desk.drawdownBaselineUsdg !== null && total !== null
      ? (() => {
          const stopAt = (desk.drawdownBaselineUsdg * BigInt(10_000 - mandate.lossStopBps)) / 10_000n
          const room = total - stopAt
          return {
            stopAtUsdg: stopAt.toString(),
            roomUsdg: room.toString(),
            roomBps: total > 0n ? Number((room * 10_000n) / total) : 0,
          }
        })()
      : null
  // The agent looks every five minutes, on the price logger's slots, and wakes the model only when something moved.
  const LOOK_MS = 5 * 60 * 1000
  const nextCheck = new Date(Math.floor(now.getTime() / LOOK_MS) * LOOK_MS + LOOK_MS)

  return {
    isOwner,
    slug,
    owner: desk.ownerAddress,
    desk: {
      id: desk.id,
      name: desk.name ?? 'Your agent',
      address: desk.address,
      mode: desk.mode,
      state: desk.state,
      stateReason: desk.stateReason,
      lifecycle: desk.lifecycle,
      assistantRemoved: desk.state === 'needs_attention' && desk.stateReason === ASSISTANT_REMOVED,
      contractVersion: desk.contractVersion,
      shareSlug: desk.shareEnabled ? desk.shareSlug : null,
      shadowChecks: desk.shadowChecks,
      goLiveChecks: GO_LIVE_CHECKS,
      reportOpened: desk.shadowReportOpenedAt !== null,
      startedAt: desk.startedAt?.toISOString() ?? null,
      lastCheckAt: lastCheck?.at.toISOString() ?? null,
      nextCheckAt: nextCheck.toISOString(),
      /** null for a visitor: whether Telegram is linked is the owner's business. */
      telegramLinked: telegram ? telegram.linked !== null : null,
    },
    limitsInUse: {
      spentTodayUsdg: spentToday.toString(),
      lossStop,
    },
    plate: snapshot
      ? {
          totalUsdg: snapshot.totalUsdg.toString(),
          cashUsdg: snapshot.cashUsdg.toString(),
          vaultUsdg: snapshot.vaultUsdg.toString(),
          vaultRateBps: snapshot.vaultUsdg > 0n ? await currentVaultRateBps() : null,
          cashBps: share(snapshot.cashUsdg + snapshot.vaultUsdg),
          takenAt: snapshot.takenAt.toISOString(),
          priceSource: snapshot.priceSource,
          baselineUsdg: desk.drawdownBaselineUsdg?.toString() ?? null,
          sinceReopenUsdg: atReopen ? (snapshot.totalUsdg - atReopen.totalUsdg).toString() : null,
          reopenedAt: reopenedAt.toISOString(),
        }
      : null,
    holdings,
    mandate: mandate
      ? {
          preset: PRESETS.find((p) => p.id === mandate.preset)?.name ?? null,
          presetId: mandate.preset,
          targets: mandate.targets.tokens.map((t) => ({
            symbol: nameOf(t.token)?.symbol ?? t.token,
            weightBps: t.weightBps,
          })),
          rules: isOwner
            ? (mandate.rules ?? []).map((r) => ({
                symbol: nameOf(r.token)?.symbol ?? r.token,
                fallBps: r.fallBps,
                cutBps: r.cutBps,
              }))
            : [],
          cashTargetBps: mandate.targets.cashBps,
          driftToleranceBps: mandate.driftToleranceBps,
          maxPositionBps: mandate.maxPositionBps,
          lossStopBps: mandate.lossStopBps,
          perActionCapUsdg: mandate.perActionCapUsdg.toString(),
          dailyCapUsdg: mandate.dailyCapUsdg.toString(),
          largeActionUsdg: mandate.largeActionUsdg.toString(),
          // The owner's notes are theirs alone. A visitor's page never receives them.
          notes: isOwner ? mandate.notes : '',
          version: mandateRow?.version ?? 0,
        }
      : null,
    approvals: approvals.map((a) => ({
      id: a.id,
      summary: a.summary ?? '',
      name: (a.token && nameOf(a.token)?.displayName) ?? a.token ?? '',
      side: a.side,
      reason: a.reason,
      expiresAt: a.expiresAt.toISOString(),
      preview: a.preview as { amountIn?: string; expectedOut?: string },
    })),
    record: groupQuietRuns(record),
    notes: notes.map((n) => ({ at: n.at.toISOString(), kind: n.kind, detail: n.detail ?? {} })),
    history: history.map((h) => ({ at: h.takenAt.toISOString(), totalUsdg: h.totalUsdg.toString() })),
    /** Token address to symbol, for logos beside decisions. */
    tokenSymbols: Object.fromEntries(
      APPROVED_TOKENS.map((t) => [t.address.toLowerCase(), t.symbol]),
    ) as Record<string, string>,
    /** The desk this one moved from: its value history and a short account of its decisions. */
    earlier: earlierDesk
      ? {
          address: earlierDesk.address,
          contractVersion: earlierDesk.contractVersion,
          history: earlierHistory.map((h) => ({
            at: h.takenAt.toISOString(),
            totalUsdg: h.totalUsdg.toString(),
          })),
          decisions: earlierRecord.map((d) => ({
            seq: d.seq,
            at: d.decidedAt.toISOString(),
            outcome: d.outcome,
            summary: d.summary,
          })),
        }
      : null,
    markers: record
      .filter(
        (d) =>
          d.token &&
          ['acted', 'acted_in_part', 'acted_by_override', 'would_have_acted', 'waited'].includes(d.outcome),
      )
      .map((d) => ({ at: d.decidedAt.toISOString(), seq: d.seq, outcome: d.outcome, shadow: d.shadow })),
    timing: {
      live: { usdg: timing.live.usdg.toString(), decisions: timing.live.decisions },
      practice: { usdg: timing.practice.usdg.toString(), decisions: timing.practice.decisions },
    },
    feeUsdg: feeUsdg.toString(),
    turns,
    /** The agent card: what it is waiting on, how many decisions it has made, and its latest real one. */
    agent: (() => {
      const count = (...o: string[]) =>
        counts.filter((c) => o.includes(c.outcome)).reduce((a, c) => a + c.n, 0)
      const latest = record.find((d) => d.outcome !== 'nothing_to_do')
      return {
        waits: waits.map((w) => {
          const candidate = (w.record as { candidate?: { amountIn?: string } | null }).candidate
          return {
            symbol: nameOf(w.token)?.symbol ?? w.token,
            name: nameOf(w.token)?.displayName ?? w.token,
            side: w.side,
            wouldHave: w.kind === 'would_have',
            amountUsdg: w.side === 'buy' ? (candidate?.amountIn ?? null) : null,
            revisitAt: w.revisitAt.toISOString(),
          }
        }),
        total: count(...counts.map((c) => c.outcome)),
        acted: count('acted', 'acted_in_part', 'acted_by_override', 'would_have_acted'),
        waited: count('waited', 'declined'),
        latest: latest
          ? {
              seq: latest.seq,
              outcome: latest.outcome,
              summary: latest.summary,
              at: latest.decidedAt.toISOString(),
            }
          : null,
      }
    })(),
  }
}

export type DeskView = NonNullable<Awaited<ReturnType<typeof loadDesk>>>

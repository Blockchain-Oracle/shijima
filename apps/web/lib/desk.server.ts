/**
 * Everything one desk's page shows, read on the server from Postgres. The owner gets the whole desk and the
 * chat. A visitor gets the same page read-only, and only when the owner turned sharing on. Nothing here reads
 * the chain or holds a key.
 */
import { APPROVED_TOKENS } from '@desk/chain'
import {
  askHistory,
  currentMandate,
  deskById,
  deskIdBySlug,
  deskRecord,
  GO_LIVE_CHECKS,
  groupQuietRuns,
  latestValueSnapshot,
  mandateFromRow,
  pendingApprovals,
  timingSummary,
  valueHistory,
} from '@desk/db'
import { PRESETS } from '@desk/shared'
import { type ChatTurn, toChatTurn } from '@/features/desk/chat-model'
import { db } from './db'
import { signedInAddress } from './session'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
/** The desk's fee, from the design brief: 0.5% a year of what it holds, shown accruing, waived in the beta. */
const FEE_BPS_A_YEAR = 50n

const nameOf = (address: string) =>
  APPROVED_TOKENS.find((t) => t.address.toLowerCase() === address.toLowerCase())

export async function loadDesk(slug: string) {
  const viewer = await signedInAddress().catch(() => undefined)
  const id = UUID.test(slug) ? slug : await deskIdBySlug(db(), slug)
  if (!id) return undefined
  const desk = await deskById(db(), id)
  if (!desk) return undefined
  const isOwner = viewer !== undefined && viewer.toLowerCase() === desk.ownerAddress.toLowerCase()
  // A visitor sees a desk only through its share link, and only while sharing is on.
  if (!isOwner && !(desk.shareEnabled && desk.shareSlug === slug)) return undefined

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

  const total = snapshot?.totalUsdg ?? null
  const share = (v: bigint) => (total && total > 0n ? Number((v * 10_000n) / total) : 0)
  const holdings = mandate
    ? mandate.targets.tokens.map((t) => {
        const held = snapshot?.holdings.find((h) => h.token.toLowerCase() === t.token.toLowerCase())
        const token = nameOf(t.token)
        const value = held ? BigInt(held.valueUsdg) : 0n
        return {
          symbol: token?.symbol ?? t.token,
          name: token?.displayName ?? t.token,
          valueUsdg: value.toString(),
          weightBps: share(value),
          targetBps: t.weightBps,
          gapToFeedBps: held?.gapToFeedBps ?? null,
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

  return {
    isOwner,
    slug,
    owner: desk.ownerAddress,
    desk: {
      id: desk.id,
      name: desk.name ?? 'Your desk',
      address: desk.address,
      mode: desk.mode,
      state: desk.state,
      stateReason: desk.stateReason,
      contractVersion: desk.contractVersion,
      shareSlug: desk.shareEnabled ? desk.shareSlug : null,
      shadowChecks: desk.shadowChecks,
      goLiveChecks: GO_LIVE_CHECKS,
      reportOpened: desk.shadowReportOpenedAt !== null,
      startedAt: desk.startedAt?.toISOString() ?? null,
    },
    plate: snapshot
      ? {
          totalUsdg: snapshot.totalUsdg.toString(),
          cashUsdg: snapshot.cashUsdg.toString(),
          vaultUsdg: snapshot.vaultUsdg.toString(),
          cashBps: share(snapshot.cashUsdg + snapshot.vaultUsdg),
          takenAt: snapshot.takenAt.toISOString(),
          priceSource: snapshot.priceSource,
          baselineUsdg: desk.drawdownBaselineUsdg?.toString() ?? null,
        }
      : null,
    holdings,
    mandate: mandate
      ? {
          preset: PRESETS.find((p) => p.id === mandate.preset)?.name ?? null,
          cashTargetBps: mandate.targets.cashBps,
          driftToleranceBps: mandate.driftToleranceBps,
          maxPositionBps: mandate.maxPositionBps,
          lossStopBps: mandate.lossStopBps,
          perActionCapUsdg: mandate.perActionCapUsdg.toString(),
          dailyCapUsdg: mandate.dailyCapUsdg.toString(),
          largeActionUsdg: mandate.largeActionUsdg.toString(),
          notes: mandate.notes,
          version: mandateRow?.version ?? 0,
        }
      : null,
    approvals: approvals.map((a) => ({
      id: a.id,
      summary: a.summary ?? '',
      side: a.side,
      reason: a.reason,
      expiresAt: a.expiresAt.toISOString(),
      preview: a.preview as { amountIn?: string; expectedOut?: string },
    })),
    record: groupQuietRuns(record),
    history: history.map((h) => ({ at: h.takenAt.toISOString(), totalUsdg: h.totalUsdg.toString() })),
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
  }
}

export type DeskView = NonNullable<Awaited<ReturnType<typeof loadDesk>>>

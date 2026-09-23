import { APPROVED_TOKENS } from '@desk/chain'
import { deskRecord, desksOfOwner, isQuiet, pendingApprovals } from '@desk/db'
import { appCopy } from '@desk/shared'
import { redirect } from 'next/navigation'
import { type ActivityRow, ActivityScreen, type NeedRow } from '@/features/activity/ActivityScreen'
import { db } from '@/lib/db'
import { signedInAddress } from '@/lib/session'

export const dynamic = 'force-dynamic'
export const metadata = { title: appCopy.activity.meta }

const symbolOf = (address: string | null) =>
  address
    ? (APPROVED_TOKENS.find((t) => t.address.toLowerCase() === address.toLowerCase())?.symbol ?? null)
    : null

const TABS = ['all', 'needs', 'trades'] as const
type Tab = (typeof TABS)[number]

/**
 * Every decision from every one of the owner's agents, newest first, with what waits on them. One place, so the
 * agent page no longer has to repeat the record: it shows the latest and links here.
 */
export default async function ActivityPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const address = await signedInAddress().catch(() => undefined)
  if (!address) redirect('/agents')
  const { tab: raw } = await searchParams
  const tab: Tab = (TABS as readonly string[]).includes(raw ?? '') ? (raw as Tab) : 'all'

  const desks = await desksOfOwner(db(), address)
  const perDesk = await Promise.all(
    desks.map(async (d) => {
      const [record, waiting] = await Promise.all([
        deskRecord(db(), d.id, { limit: 80 }),
        d.lifecycle === 'closed' ? Promise.resolve([]) : pendingApprovals(db(), d.id),
      ])
      const agent = { id: d.id, name: d.name ?? 'Agent', slug: d.shareSlug ?? d.id }
      const rows: ActivityRow[] = record
        .filter((r) => !isQuiet(r))
        .map((r) => ({
          agent,
          seq: r.seq,
          outcome: r.outcome,
          shadow: r.shadow,
          side: r.side,
          symbol: symbolOf(r.token),
          summary: r.summary,
          at: r.decidedAt.toISOString(),
        }))
      const needs: NeedRow[] = waiting.map((w) => ({
        agent,
        approvalId: w.id,
        seq: w.decisionSeq,
        summary: w.summary,
        symbol: symbolOf(w.token),
        expiresAt: w.expiresAt.toISOString(),
        createdAt: w.createdAt.toISOString(),
      }))
      return { rows, needs }
    }),
  )

  return (
    <ActivityScreen
      tab={tab}
      rows={perDesk.flatMap((d) => d.rows).sort((a, b) => b.at.localeCompare(a.at))}
      needs={perDesk.flatMap((d) => d.needs).sort((a, b) => b.createdAt.localeCompare(a.createdAt))}
    />
  )
}

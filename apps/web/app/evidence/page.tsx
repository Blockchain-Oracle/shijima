import { EXPLORER } from '@desk/chain'
import { deskRecord, desksOfOwner, isQuiet } from '@desk/db'
import { marketsCopy, moneyCopy, OPENSERV, short } from '@desk/shared'
import { EvidenceScreen } from '@/features/money/EvidenceScreen'
import { SignedOutCard } from '@/features/money/SignedOutCard'
import { currentDeployment } from '@/lib/chain'
import { db } from '@/lib/db'
import { signedInAddress } from '@/lib/session'

export const dynamic = 'force-dynamic'
export const metadata = { title: moneyCopy.evidence.meta }

const when = (d: Date) =>
  d.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).concat(' UTC')

/** Evidence: every decision of every agent you own, its fingerprint and its seal on chain, and the contracts. */
export default async function EvidencePage() {
  const address = await signedInAddress().catch(() => undefined)
  if (!address) return <SignedOutCard />
  const c = moneyCopy.evidence
  const d = currentDeployment()
  const desks = await desksOfOwner(db(), address)
  const agents = await Promise.all(
    desks.map(async (desk) => {
      const record = await deskRecord(db(), desk.id, { limit: 60 })
      return {
        name: desk.name ?? 'Agent',
        slug: desk.shareSlug ?? desk.id,
        address: desk.address,
        rows: record
          .filter((r) => !isQuiet(r))
          .map((r) => ({
            seq: r.seq,
            summary: r.summary,
            outcome: r.outcome,
            outcomeLabel: marketsCopy.outcomes[r.outcome] ?? r.outcome,
            shadow: r.shadow,
            recordHash: r.recordHash,
            sealedByTx: r.sealedByTx ?? null,
            at: when(r.decidedAt),
          })),
      }
    }),
  )
  const facts = [
    { label: c.network, value: c.networkValue, href: EXPLORER },
    { label: c.factory, value: short(d.factory, 6, 4), href: `${EXPLORER}/address/${d.factory}` },
    { label: c.operator, value: short(d.operator, 6, 4), href: `${EXPLORER}/address/${d.operator}` },
    { label: c.openserv, value: `#${OPENSERV.agentId}`, href: OPENSERV.agentUrl },
    { label: c.identity, value: `#${OPENSERV.identity.tokenId}`, href: OPENSERV.identity.url },
  ]
  return <EvidenceScreen facts={facts} agents={agents} />
}

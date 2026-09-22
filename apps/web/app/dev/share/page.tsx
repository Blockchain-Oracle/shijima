import { decisionInFull, deskByShareSlug, deskRecord, sharedDesks } from '@desk/db'
import { viewRecord } from '@desk/shared'
import { SectionHeader } from '@/components/ui/section-header'
import { decisionCard } from '@/features/share/card-data'
import type { DecisionCard } from '@/features/share/decision-card'
import { db } from '@/lib/db'
import { ShareGallery } from './ShareGallery'

export const metadata = { title: 'Fixtures · share cards', robots: { index: false } }
export const dynamic = 'force-dynamic'

/**
 * The share card drawn from real records (FIDELITY L-22, Agari's `/dev/share`): the latest decision of each kind
 * on the first shared desk, each through the same builder and renderer the decision page uses.
 */
export default async function SharePage() {
  const [first] = await sharedDesks(db())
  const desk = first?.shareSlug ? await deskByShareSlug(db(), first.shareSlug) : undefined
  const cards: DecisionCard[] = []
  if (desk) {
    const seen = new Set<string>()
    for (const row of await deskRecord(db(), desk.id, { limit: 200 })) {
      const key = `${row.outcome}:${row.side ?? ''}`
      if (seen.has(key)) continue
      seen.add(key)
      const full = await decisionInFull(db(), desk.id, row.seq)
      if (full) cards.push(decisionCard(desk, full, viewRecord(full.decision.record)))
    }
  }
  return (
    <div className="container flex flex-col gap-6 py-8">
      <SectionHeader
        index="01"
        title="Share cards"
        desc={
          desk
            ? `The latest decision of each kind on ${desk.name ?? desk.shareSlug}, drawn as it would be shared.`
            : 'No desk is shared yet.'
        }
      />
      <ShareGallery cards={cards} />
    </div>
  )
}

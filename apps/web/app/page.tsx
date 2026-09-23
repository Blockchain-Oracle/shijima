import { desksOfOwner } from '@desk/db'
import { homeCopy } from '@desk/shared'
import type { Route } from 'next'
import { redirect } from 'next/navigation'
import { HomePage } from '@/features/home/HomePage'
import { currentDeployment } from '@/lib/chain'
import { db } from '@/lib/db'
import { currentVaultRateBps, loadDesk } from '@/lib/desk.server'
import { loadWeekendFact, presetPerformance } from '@/lib/markets.server'
import { signedInAddress } from '@/lib/session'

export const dynamic = 'force-dynamic'
export const metadata = { title: { absolute: homeCopy.meta.title }, description: homeCopy.meta.description }

/** The shared desk the home page shows at work. It is Abu's live dev desk, shared read-only. */
const SHOWCASE_SLUG = 'showcase'

/**
 * `/` sends an owner to their desk, where their agent and its chat are. A signed-in wallet with no desk goes to
 * start one. Everyone else meets Shijima here first: what it is, a live agent at work, and how to start.
 */
export default async function Home() {
  const address = await signedInAddress().catch(() => undefined)
  if (address) {
    const [desk] = await desksOfOwner(db(), address)
    if (desk) redirect(`/desk/${desk.shareSlug ?? desk.id}` as Route)
    redirect('/strategies')
  }
  const [showcase, weekendFact, performance, vaultRateBps] = await Promise.all([
    loadDesk(SHOWCASE_SLUG).catch(() => undefined),
    loadWeekendFact().catch(() => null),
    presetPerformance(30).catch(() => []),
    currentVaultRateBps().catch(() => null),
  ])
  return (
    <HomePage
      showcase={showcase}
      weekendFact={weekendFact}
      performance={performance}
      vaultRateBps={vaultRateBps}
      factory={currentDeployment().factory}
    />
  )
}

import { desksOfOwner } from '@desk/db'
import { homeCopy } from '@desk/shared'
import type { Route } from 'next'
import { redirect } from 'next/navigation'
import { Landing } from '@/features/home/Landing'
import { db } from '@/lib/db'
import { signedInAddress } from '@/lib/session'

export const dynamic = 'force-dynamic'
export const metadata = { title: { absolute: homeCopy.meta.title }, description: homeCopy.meta.description }

/**
 * `/` (DECISIONS F8): an owner with an open agent goes straight to their newest one, which is what they came to
 * see. Everyone else gets the landing page, which stays reachable at `/home` from the app.
 */
export default async function Home() {
  const address = await signedInAddress().catch(() => undefined)
  if (address) {
    const open = (await desksOfOwner(db(), address).catch(() => [])).find((d) => d.lifecycle !== 'closed')
    if (open) redirect(`/agents/${open.shareSlug ?? open.id}` as Route)
  }
  return <Landing />
}

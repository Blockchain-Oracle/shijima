import { desksOfOwner } from '@desk/db'
import type { Route } from 'next'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { signedInAddress } from '@/lib/session'

export const dynamic = 'force-dynamic'

/**
 * No home page, as in Masayume: `/` sends you where you belong. An owner goes to their desk, where the chat is
 * first. A signed-in wallet with no desk goes to start one. Everyone else sees the markets.
 */
export default async function Home() {
  const address = await signedInAddress().catch(() => undefined)
  if (address) {
    const [desk] = await desksOfOwner(db(), address)
    if (desk) redirect(`/desk/${desk.shareSlug ?? desk.id}` as Route)
    redirect('/start')
  }
  redirect('/markets')
}

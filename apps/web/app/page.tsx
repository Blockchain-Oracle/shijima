import { homeCopy } from '@desk/shared'
import type { Route } from 'next'
import { redirect } from 'next/navigation'
import { Landing } from '@/features/home/Landing'
import { signedInAddress } from '@/lib/session'

export const dynamic = 'force-dynamic'
export const metadata = { title: { absolute: homeCopy.meta.title }, description: homeCopy.meta.description }

/**
 * `/` (DECISIONS W1, which supersedes F8): a signed-in owner goes to their wallet, where everything they hold is.
 * Everyone else gets the landing page, which stays reachable at `/home` from the app.
 */
export default async function Home() {
  const address = await signedInAddress().catch(() => undefined)
  if (address) redirect('/wallet' as Route)
  return <Landing />
}

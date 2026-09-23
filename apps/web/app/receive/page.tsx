import { desksOfOwner } from '@desk/db'
import { moneyCopy } from '@desk/shared'
import { ReceiveScreen, type ReceiveTarget } from '@/features/money/ReceiveScreen'
import { SignedOutCard } from '@/features/money/SignedOutCard'
import { db } from '@/lib/db'
import { signedInAddress } from '@/lib/session'

export const dynamic = 'force-dynamic'
export const metadata = { title: moneyCopy.receive.meta }

/** Receive: your wallet's address and each open agent's, with QR codes. `?agent=slug` opens on that agent. */
export default async function ReceivePage({ searchParams }: { searchParams: Promise<{ agent?: string }> }) {
  const address = await signedInAddress().catch(() => undefined)
  if (!address) return <SignedOutCard />
  const [{ agent }, desks] = await Promise.all([searchParams, desksOfOwner(db(), address)])
  const targets: ReceiveTarget[] = [
    { key: 'wallet', name: moneyCopy.receive.tabWallet, address, kind: 'wallet' },
    ...desks
      .filter((d) => d.lifecycle !== 'closed')
      .map((d) => ({
        key: d.shareSlug ?? d.id,
        name: d.name ?? 'Agent',
        address: d.address,
        kind: 'agent' as const,
      })),
  ]
  return <ReceiveScreen targets={targets} initial={agent ?? 'wallet'} />
}

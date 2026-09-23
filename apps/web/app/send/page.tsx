import { moneyCopy } from '@desk/shared'
import { SendScreen } from '@/features/money/SendScreen'
import { SignedOutCard } from '@/features/money/SignedOutCard'
import { walletAssets } from '@/lib/money/assets.server'
import { signedInAddress } from '@/lib/session'

export const dynamic = 'force-dynamic'
export const metadata = { title: moneyCopy.send.meta }

/** Send from your own wallet: what it holds now, read from the chain. */
export default async function SendPage() {
  const address = await signedInAddress().catch(() => undefined)
  if (!address) return <SignedOutCard />
  const { assets } = await walletAssets(address)
  return <SendScreen owner={address} assets={assets} />
}

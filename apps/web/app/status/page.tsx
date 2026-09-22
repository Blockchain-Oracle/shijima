import { statusCopy } from '@desk/shared'
import { StatusScreen } from '@/features/status/StatusScreen'
import { signedInAddress } from '@/lib/session'
import { loadStatus } from '@/lib/status.server'

export const dynamic = 'force-dynamic'
export const metadata = { title: statusCopy.title, description: statusCopy.description }

/** Is the desk awake [8.16]. Rendered with a first reading, then refreshed in the browser every 30 seconds. */
export default async function Status() {
  const viewer = await signedInAddress().catch(() => undefined)
  const first = await loadStatus(viewer).catch(() => null)
  return <StatusScreen first={first} />
}

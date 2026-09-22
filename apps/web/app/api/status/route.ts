import { signedInAddress } from '@/lib/session'
import { loadStatus } from '@/lib/status.server'

/** The status screen's refresh. Public: it shows only shared desks, plus the caller's own when signed in. */
export async function GET() {
  try {
    const viewer = await signedInAddress().catch(() => undefined)
    return Response.json(await loadStatus(viewer), { headers: { 'cache-control': 'no-store' } })
  } catch {
    return Response.json({ error: 'unreachable' }, { status: 503, headers: { 'cache-control': 'no-store' } })
  }
}

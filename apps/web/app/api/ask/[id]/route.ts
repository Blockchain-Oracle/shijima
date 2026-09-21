import { askRequestForOwner } from '@desk/db'
import { toChatTurn } from '@/features/desk/chat-model'
import { db } from '@/lib/db'
import { signedInAddress } from '@/lib/session'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * One message and its answer, for the browser to poll. Only its sender can read it. While the worker is still
 * answering, `status` is pending or claimed and there is no reply yet.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const address = await signedInAddress()
  if (!address) return Response.json({ error: 'Sign in to talk to your desk.' }, { status: 401 })
  const { id } = await params
  if (!UUID.test(id)) return Response.json({ error: 'No such message.' }, { status: 404 })
  const row = await askRequestForOwner(db(), id, address)
  if (!row) return Response.json({ error: 'No such message.' }, { status: 404 })
  const turn = toChatTurn(row, row.proposal ? { ...row.proposal, result: row.proposal.result ?? null } : null)
  return Response.json({ turn }, { headers: { 'cache-control': 'no-store' } })
}

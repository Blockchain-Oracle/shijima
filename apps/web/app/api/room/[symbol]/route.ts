import { holdsToken, insertRoomPost, roomThread } from '@desk/db'
import { errorText, roomCopy } from '@desk/shared'
import { currentMember, withinLimits } from '@/features/social/member.server'
import {
  isStockSymbol,
  normalizeText,
  ROOM_BODY_MAX,
  type RoomGate,
  type RoomLineView,
  shortAddress,
  TOKEN_BY_SYMBOL,
} from '@/features/social/protocol'
import { db } from '@/lib/db'
import { sameOrigin } from '@/lib/origin'

/**
 * One Stock Token's Room, from Agari (`app/api/room/route.ts`). Reading and posting are both for members, as in
 * Agari: a desk owner signed in with the wallet that owns the desk. The author is the session's wallet, never a
 * field in the request, and "holds it" is checked against the desk's own latest valuation.
 */
const NO_STORE = { 'Cache-Control': 'no-store' }

const refuse = (error: string, status: number) => Response.json({ error }, { status, headers: NO_STORE })

export async function GET(_request: Request, { params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params
  if (!isStockSymbol(symbol)) return refuse(roomCopy.errors.badRequest, 404)
  try {
    const member = await currentMember()
    if (member.kind !== 'member') {
      const gate: RoomGate = member.kind === 'signed_out' ? 'connect' : 'locked'
      return Response.json({ gate, lines: [] }, { headers: NO_STORE })
    }
    const lines: RoomLineView[] = (await roomThread(db(), symbol)).map((line) => ({
      id: line.id,
      author: shortAddress(line.author),
      body: line.body,
      holds: line.holds,
      createdAtMs: line.createdAt.getTime(),
      mine: line.author === member.address,
    }))
    return Response.json({ gate: 'joined' satisfies RoomGate, lines }, { headers: NO_STORE })
  } catch (e) {
    console.warn('[room] read failed:', errorText(e))
    return Response.json(
      { gate: 'unavailable' satisfies RoomGate, lines: [] },
      { status: 503, headers: NO_STORE },
    )
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ symbol: string }> }) {
  if (!sameOrigin(request)) return refuse(roomCopy.errors.badRequest, 403)
  const { symbol } = await params
  const token = TOKEN_BY_SYMBOL.get(symbol)
  if (!token) return refuse(roomCopy.errors.badRequest, 404)
  let input: { body?: unknown; holds?: unknown }
  try {
    input = await request.json()
  } catch {
    return refuse(roomCopy.errors.badRequest, 400)
  }
  const body = typeof input.body === 'string' ? normalizeText(input.body, ROOM_BODY_MAX) : ''
  if (body.length === 0) return refuse(roomCopy.errors.badRequest, 400)
  try {
    const member = await currentMember()
    if (member.kind !== 'member')
      return refuse(roomCopy.errors.notMember, member.kind === 'signed_out' ? 401 : 403)
    if (!(await withinLimits('room', member.ownerId))) return refuse(roomCopy.errors.rateLimited, 429)
    const holds = input.holds === true && (await holdsToken(db(), member.ownerId, token.address))
    const row = await insertRoomPost(db(), { symbol, ownerId: member.ownerId, body, holds })
    if (!row) return refuse(roomCopy.errors.postFailed, 500)
    // The server's own row, not an echo of the request: what is on screen is what was stored.
    const line: RoomLineView = {
      id: row.id,
      author: shortAddress(member.address),
      body: row.body,
      holds: row.holds,
      createdAtMs: row.createdAt.getTime(),
      mine: true,
    }
    return Response.json({ line }, { headers: NO_STORE })
  } catch (e) {
    console.warn('[room] post failed:', errorText(e))
    return refuse(roomCopy.errors.postFailed, 503)
  }
}

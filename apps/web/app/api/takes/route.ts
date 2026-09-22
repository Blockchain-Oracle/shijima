import { holdsToken, insertTake, latestTakes } from '@desk/db'
import { errorText, takesCopy } from '@desk/shared'
import { currentMember, withinLimits } from '@/features/social/member.server'
import {
  isStockSymbol,
  normalizeText,
  parseCashtags,
  shortAddress,
  TAKE_MAX,
  TAKES_FEED_LIMIT,
  type TakeView,
  TOKEN_BY_SYMBOL,
} from '@/features/social/protocol'
import { db } from '@/lib/db'
import { sameOrigin } from '@/lib/origin'

/**
 * Takes, from Agari (`app/api/takes/route.ts`). Reading is public, like a shared desk, and can be narrowed to one
 * stock (`?symbol=NVDA`). Posting is for desk owners; the author is the session's wallet and "desk holds it" is
 * checked against the author's own latest valuation, so no client can assert it.
 */
const NO_STORE = { 'Cache-Control': 'no-store' }

const refuse = (error: string, status: number) => Response.json({ error }, { status, headers: NO_STORE })

const view = (row: Awaited<ReturnType<typeof latestTakes>>[number]): TakeView => ({
  id: row.id,
  author: shortAddress(row.author),
  symbol: row.symbol,
  caption: row.caption,
  tags: row.tags,
  holds: row.holds,
  createdAtMs: row.createdAt.getTime(),
})

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const symbol = params.get('symbol') ?? undefined
  if (symbol !== undefined && !isStockSymbol(symbol)) return refuse(takesCopy.errors.badRequest, 400)
  const asked = Number(params.get('limit'))
  const limit = Number.isInteger(asked) && asked > 0 ? Math.min(asked, 100) : TAKES_FEED_LIMIT
  try {
    const rows = await latestTakes(db(), { limit, symbol })
    return Response.json({ takes: rows.map(view) }, { headers: { 'Cache-Control': 'public, s-maxage=5' } })
  } catch (e) {
    console.warn('[takes] read failed:', errorText(e))
    return refuse(takesCopy.errors.postFailed, 503)
  }
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return refuse(takesCopy.errors.badRequest, 403)
  let input: { symbol?: unknown; caption?: unknown; holds?: unknown }
  try {
    input = await request.json()
  } catch {
    return refuse(takesCopy.errors.badRequest, 400)
  }
  const token = typeof input.symbol === 'string' ? TOKEN_BY_SYMBOL.get(input.symbol) : undefined
  const caption = typeof input.caption === 'string' ? normalizeText(input.caption, TAKE_MAX) : ''
  if (!token || caption.length === 0) return refuse(takesCopy.errors.badRequest, 400)
  try {
    const member = await currentMember()
    if (member.kind !== 'member')
      return refuse(takesCopy.errors.notMember, member.kind === 'signed_out' ? 401 : 403)
    if (!(await withinLimits('takes', member.ownerId))) return refuse(takesCopy.errors.rateLimited, 429)
    const holds = input.holds === true && (await holdsToken(db(), member.ownerId, token.address))
    const row = await insertTake(db(), {
      ownerId: member.ownerId,
      symbol: token.symbol,
      caption,
      tags: parseCashtags(caption, token.symbol),
      holds,
    })
    if (!row) return refuse(takesCopy.errors.postFailed, 500)
    const take: TakeView = { ...view({ ...row, author: member.address }) }
    return Response.json({ take }, { headers: NO_STORE })
  } catch (e) {
    console.warn('[takes] post failed:', errorText(e))
    return refuse(takesCopy.errors.postFailed, 503)
  }
}

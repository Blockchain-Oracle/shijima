import { APPROVED_TOKENS } from '@desk/chain'
import { latestPricePoints } from '@desk/db'
import { db } from '@/lib/db'

/** Public discovery uses the same approved catalog and logged prices as the markets page. */
export async function GET() {
  const points = await latestPricePoints(db()).catch(() => [])
  const tokens = APPROVED_TOKENS.map((token) => {
    const point = points.find((p) => p.token.toLowerCase() === token.address.toLowerCase())
    return {
      symbol: token.symbol,
      name: token.displayName,
      price: point?.poolMidE8 == null ? null : Number(point.poolMidE8) / 1e8,
      at: point?.at.toISOString() ?? null,
    }
  })
  return Response.json({ tokens }, { headers: { 'cache-control': 'no-store' } })
}

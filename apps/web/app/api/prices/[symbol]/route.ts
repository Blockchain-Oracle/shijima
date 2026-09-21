import { APPROVED_TOKENS } from '@desk/chain'
import { priceSeries } from '@desk/db'
import { db } from '@/lib/db'

/**
 * One Stock Token's logged prices, for a chart in the chat or on a stock page. Public, like the prices. At most
 * 30 days, thinned to about 300 points so a phone draws it at once.
 */
export async function GET(request: Request, { params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params
  const token = APPROVED_TOKENS.find((t) => t.symbol === symbol.toUpperCase())
  if (!token) return Response.json({ error: 'No such Stock Token.' }, { status: 404 })
  const days = Math.min(Math.max(Number(new URL(request.url).searchParams.get('days') ?? 7) || 7, 1), 30)
  const to = new Date()
  const rows = await priceSeries(db(), token.address, new Date(to.getTime() - days * 86_400_000), to)
  const priced = rows.filter((r) => r.poolMidE8 !== null)
  const step = Math.max(1, Math.ceil(priced.length / 300))
  const points = priced
    .filter((_, i) => i % step === 0 || i === priced.length - 1)
    .map((r) => ({ time: Math.floor(r.at.getTime() / 1000), value: Number(r.poolMidE8) / 1e8 }))
  const last = priced.at(-1)
  return Response.json(
    {
      symbol: token.symbol,
      name: token.displayName,
      points,
      reference: last?.referenceE8 ? Number(last.referenceE8) / 1e8 : null,
      referenceKind: last?.referenceKind ?? null,
    },
    { headers: { 'cache-control': 'no-store' } },
  )
}

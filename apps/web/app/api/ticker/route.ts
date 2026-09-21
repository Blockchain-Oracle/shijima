import { tickerCells } from '@/lib/shell.server'

/** The ticker's refresh: the latest logged price of each Stock Token. Public, like the prices themselves. */
export async function GET() {
  try {
    return Response.json({ cells: await tickerCells() }, { headers: { 'cache-control': 'no-store' } })
  } catch {
    return Response.json({ cells: [] }, { status: 503 })
  }
}

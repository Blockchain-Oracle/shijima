/**
 * The price history the charts draw. Reads the chain only. Never trades.
 *
 *   pnpm prices:log                       write the current five-minute slot, once
 *   pnpm prices:backfill [--days 30]      fill hourly rows for the past days, oldest first, skipping any hour
 *                                         already written. Slow on purpose: one hour at a time, so it never
 *                                         competes with the engine for the RPC budget.
 *
 * The halt flag has no history, so backfilled rows store it as unknown. Set RPC_URL to use a fork.
 */
import { APPROVED_TOKENS, blockAtOrBefore, makePublicClient, OFFICIAL_RPC } from '@desk/chain'
import { chainReferenceSource, logPrices, priceSlot, readPricePoint } from '@desk/core'
import { createDb, priceSlotWritten, savePricePoints } from '@desk/db'
import { errorText, registerSecretsFromEnv } from '@desk/shared'

registerSecretsFromEnv(process.env)
const rpc = process.env.RPC_URL ?? `https://robinhood-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_KEY}`
const pub = makePublicClient(process.env.RPC_URL ? [rpc] : [rpc, OFFICIAL_RPC])
const url = process.env.RPC_URL ? process.env.REHEARSAL_DATABASE_URL : process.env.DATABASE_URL
if (!url) throw new Error('no database URL in .env')
const { db, close } = createDb(url, { max: 2 })
const reference = chainReferenceSource(db, pub)
const log = (event: string, detail: Record<string, unknown> = {}) =>
  console.log(JSON.stringify({ event, ...detail }))

try {
  if (process.argv[2] === 'backfill') {
    const i = process.argv.indexOf('--days')
    const days = i === -1 ? 30 : Number(process.argv[i + 1])
    const HOUR = 60 * 60 * 1000
    const end = priceSlot(new Date())
    let written = 0
    for (
      let t = new Date(Math.floor((end.getTime() - days * 24 * HOUR) / HOUR) * HOUR);
      t < end;
      t = new Date(t.getTime() + HOUR)
    ) {
      if (await priceSlotWritten(db, t)) continue
      const mark = await blockAtOrBefore(pub, t)
      const rows = []
      for (const token of APPROVED_TOKENS) {
        try {
          rows.push(await readPricePoint(pub, token, t, reference, mark.number))
        } catch (e) {
          log('price_unread', { at: t.toISOString(), token: token.symbol, error: errorText(e).slice(0, 120) })
        }
      }
      written += await savePricePoints(db, rows)
      if (t.getUTCHours() === 0) log('backfill', { day: t.toISOString().slice(0, 10), rowsSoFar: written })
    }
    log('backfill_done', { rows: written })
  } else {
    log('prices', { rows: await logPrices({ db, pub, approved: APPROVED_TOKENS, reference, log }) })
  }
} finally {
  await close()
}

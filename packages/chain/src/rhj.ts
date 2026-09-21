/**
 * Robinhood's public Stock Token API. It is the ONLY place a trading halt is visible: no on-chain flag exists.
 *
 * TRAP, measured 2026-09-19 and 20: on weekends the bid and ask are frozen at Friday's values while
 * `generatedAt` refreshes to the current second. Never use `generatedAt` as the age of the quote. And these
 * prices are per SHARE, while the pool and the Chainlink feed price one raw TOKEN. Multiply by uiMultiplier
 * before comparing with anything on-chain.
 */
import { RHJ_API } from './addresses'

export interface HaltReading {
  symbol: string
  isTradingHalt: boolean
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Returns undefined when the API cannot be reached. The caller must treat "unknown" as "do not trade". */
export async function fetchHaltFlag(symbol: string, attempts = 4): Promise<HaltReading | undefined> {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(`${RHJ_API}/prices/${encodeURIComponent(symbol)}`, {
        signal: AbortSignal.timeout(20_000),
      })
      if (!res.ok) throw new Error(`status ${res.status}`)
      const body = (await res.json()) as { quotes?: Array<{ tokenSymbol: string; isTradingHalt: boolean }> }
      const q = body.quotes?.[0]
      if (q && typeof q.isTradingHalt === 'boolean')
        return { symbol: q.tokenSymbol, isTradingHalt: q.isTradingHalt }
      throw new Error('unexpected response shape')
    } catch {
      await sleep(1200 * (i + 1))
    }
  }
  return undefined
}

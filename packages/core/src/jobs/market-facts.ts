/**
 * Facts about each Stock Token that change rarely, for the stock pages: its multiplier changes, read from the
 * chain, and its report dates, from Finnhub's calendar. Reads only. Never trades.
 */
import { type ApprovedToken, stockTokenAbi } from '@desk/chain'
import {
  type CompanyEventInsert,
  type Db,
  lastMultiplierBlock,
  type MultiplierEventInsert,
  saveCompanyEvents,
  saveMultiplierEvents,
} from '@desk/db'
import type { PublicClient } from 'viem'

const ONE = 10n ** 18n

/**
 * A dividend raises the multiplier by its yield, a fraction of a percent. A split multiplies it. Anything else,
 * such as a fall, is named "other" rather than guessed.
 */
export function multiplierKind(oldRaw: bigint, newRaw: bigint): MultiplierEventInsert['kind'] {
  if (oldRaw === 0n || newRaw <= oldRaw) return 'other'
  const ratioE6 = (newRaw * 1_000_000n) / oldRaw
  if (ratioE6 < 1_250_000n) return 'dividend'
  return 'split'
}

/**
 * Reads every multiplier change since the last one saved. The first run reads from the chain's start: the node
 * is a full archive, and one log query spans the whole chain.
 */
export async function syncMultipliers(db: Db, pub: PublicClient, approved: ApprovedToken[]): Promise<number> {
  const last = await lastMultiplierBlock(db)
  const toBlock = await pub.getBlockNumber()
  const fromBlock = last === null ? 0n : BigInt(last) + 1n
  if (fromBlock > toBlock) return 0
  const logs = await pub.getContractEvents({
    address: approved.map((t) => t.address),
    abi: stockTokenAbi,
    eventName: 'UIMultiplierUpdated',
    fromBlock,
    toBlock,
  })
  const rows: MultiplierEventInsert[] = logs.flatMap((l) => {
    const { oldMultiplier, newMultiplier, effectiveAtTimestamp } = l.args
    if (oldMultiplier === undefined || newMultiplier === undefined || effectiveAtTimestamp === undefined)
      return []
    if (l.transactionHash === null || l.logIndex === null || l.blockNumber === null) return []
    return [
      {
        token: l.address,
        kind: multiplierKind(oldMultiplier, newMultiplier),
        oldMultiplierRaw: oldMultiplier,
        newMultiplierRaw: newMultiplier,
        txHash: l.transactionHash,
        logIndex: l.logIndex,
        blockNumber: Number(l.blockNumber),
        at: new Date(Number(effectiveAtTimestamp) * 1000),
      },
    ]
  })
  return saveMultiplierEvents(db, rows)
}

/** One multiplier as shares per token, "1.000775". */
export const sharesPerToken = (raw: bigint): string =>
  (Number((raw * 1_000_000n) / ONE) / 1_000_000).toFixed(6)

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

interface FinnhubEarning {
  symbol?: string
  date?: string
  hour?: string
  quarter?: number
  year?: number
}

/** One symbol's report dates, or undefined when Finnhub cannot be reached. A fund simply has none. */
async function fetchEarnings(symbol: string, apiKey: string, from: string, to: string) {
  const url = `https://finnhub.io/api/v1/calendar/earnings?from=${from}&to=${to}&symbol=${encodeURIComponent(symbol)}&token=${apiKey}`
  for (let i = 0; i < 4; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(25_000) })
      if (!res.ok) throw new Error(`status ${res.status}`)
      const body = (await res.json()) as { earningsCalendar?: FinnhubEarning[] }
      if (!Array.isArray(body.earningsCalendar)) throw new Error('unexpected response shape')
      return body.earningsCalendar
    } catch {
      await sleep(1500 * (i + 1))
    }
  }
  return undefined
}

/**
 * Saves each company's report dates from a week ago to four months ahead. Only the date, the hour and the
 * quarter are kept: those are facts, and nothing of Finnhub's own text is passed on.
 */
export async function syncEarnings(
  db: Db,
  approved: ApprovedToken[],
  apiKey: string,
  now = new Date(),
): Promise<{ saved: number; unreachable: string[] }> {
  const day = (d: Date) => d.toISOString().slice(0, 10)
  const from = day(new Date(now.getTime() - 7 * 86_400_000))
  const to = day(new Date(now.getTime() + 120 * 86_400_000))
  const rows: CompanyEventInsert[] = []
  const unreachable: string[] = []
  for (const token of approved) {
    const items = await fetchEarnings(token.symbol, apiKey, from, to)
    if (!items) {
      unreachable.push(token.symbol)
      continue
    }
    for (const e of items) {
      if (!e.date || !/^\d{4}-\d{2}-\d{2}$/.test(e.date)) continue
      rows.push({
        token: token.address,
        symbol: token.symbol,
        kind: 'earnings',
        eventDate: e.date,
        timing: e.hour && ['bmo', 'amc', 'dmh'].includes(e.hour) ? e.hour : null,
        source: 'finnhub',
        payload: { quarter: e.quarter ?? null, year: e.year ?? null },
      })
    }
  }
  return { saved: await saveCompanyEvents(db, rows), unreachable }
}

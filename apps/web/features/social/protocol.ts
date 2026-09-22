/**
 * What Rooms and Takes send over the wire, shared by the browser and the routes so both hold the same limits.
 * From Agari (`features/room/protocol.ts`, `features/takes/protocol.ts`, `features/takes/cashtags.ts`).
 */
import { APPROVED_TOKENS } from '@desk/chain'

export const ROOM_BODY_MAX = 280
/** One confident sentence, not an essay: Agari's cap. */
export const TAKE_MAX = 240
/** The most tickers one take is filed under; the stock it is about is always one of them. */
export const TAKE_TAGS_MAX = 4
export const TAKES_FEED_LIMIT = 30

/** The approved Stock Tokens by ticker. A Room exists for each of these and nothing else. */
export const TOKEN_BY_SYMBOL = new Map(APPROVED_TOKENS.map((t) => [t.symbol, t]))
export const isStockSymbol = (value: unknown): value is string =>
  typeof value === 'string' && TOKEN_BY_SYMBOL.has(value)

/** Collapse runs of whitespace, as Agari does, so a wall of newlines cannot be used to shout. */
export const normalizeText = (raw: string, max: number) => raw.replace(/\s+/g, ' ').trim().slice(0, max)

/** Where a signed-in wallet stands with the Room. No join signature: the sign-in already proved the wallet. */
export type RoomGate = 'unavailable' | 'connect' | 'locked' | 'joined'

export interface RoomLineView {
  id: string
  author: string
  body: string
  holds: boolean
  createdAtMs: number
  mine: boolean
}

export interface TakeView {
  id: string
  author: string
  symbol: string
  caption: string
  tags: string[]
  holds: boolean
  createdAtMs: number
}

/** `$` then one to five capitals, ending at a word boundary: `$NVDA,` and `$GOOGL` match, `$NVDAx` does not. */
const CASHTAG_RE = /\$([A-Z]{1,5})\b/g

/** The tickers a take is filed under: its stock first, then every approved `$TICKER` its words name, no repeats. */
export function parseCashtags(caption: string, symbol: string): string[] {
  const tags: string[] = []
  const add = (s: string | undefined) => {
    if (tags.length < TAKE_TAGS_MAX && isStockSymbol(s) && !tags.includes(s)) tags.push(s)
  }
  add(symbol)
  for (const match of caption.matchAll(CASHTAG_RE)) add(match[1])
  return tags
}

export type CaptionPart = { text: string } | { text: string; symbol: string }

/** A caption cut into plain runs and approved cashtags, so each tag can link to its stock page. */
export function captionParts(caption: string): CaptionPart[] {
  const parts: CaptionPart[] = []
  let from = 0
  for (const match of caption.matchAll(CASHTAG_RE)) {
    const symbol = match[1]
    if (!isStockSymbol(symbol)) continue
    if (match.index > from) parts.push({ text: caption.slice(from, match.index) })
    parts.push({ text: match[0], symbol })
    from = match.index + match[0].length
  }
  if (from < caption.length) parts.push({ text: caption.slice(from) })
  return parts
}

export const shortAddress = (address: string): string =>
  address.length > 10 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address

/** Agari's `timeAgo`, at a minute's grain. */
export function timeAgo(ms: number, nowMs: number): string {
  const seconds = Math.floor((nowMs - ms) / 1000)
  if (seconds < 60) return 'now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  return hours < 24 ? `${hours}h` : `${Math.floor(hours / 24)}d`
}

import type { DeskMark, Point, TokenNow } from '@/lib/markets.server'

/** One Stock Token on the reel: what the markets page's card knows, with its line since the reference was set. */
export interface StockReel {
  token: Omit<TokenNow, 'at' | 'referenceAt' | 'officialAt'> & { at: string }
  points: Point[]
}

/** One thing a shared desk decided, as the markets page marks it, with its stock's line to set it on. */
export interface DecisionReel {
  mark: DeskMark
  points: Point[]
}

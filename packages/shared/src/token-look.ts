/**
 * Each Stock Token's colour in charts: one per symbol, so Nvidia is the same green in the donut, the bar and the
 * legend. Presentation only, kept apart from the chain's token list. The logos themselves are Agari's asset discs
 * (`apps/web/features/markets/marks.tsx`); the tile and monogram here serve cash and anything unknown.
 */
export interface TokenLook {
  /** Chart colour: donut slice, bar segment, legend dot. */
  color: string
  /** The tile behind the logo or monogram. */
  tile: string
  /** Ink for the monogram. */
  ink: string
  /** Short text for the monogram tile. */
  monogram: string
}

export const TOKEN_LOOK: Record<string, TokenLook> = {
  SPY: { color: '#5B8DEF', tile: '#1B2A4A', ink: '#DCE6FB', monogram: 'S&P' },
  QQQ: { color: '#9B87F5', tile: '#2A2150', ink: '#E7E1FD', monogram: 'NDX' },
  NVDA: { color: '#76B900', tile: '#0B0B0B', ink: '#76B900', monogram: 'NV' },
  AAPL: { color: '#B8B8B8', tile: '#FFFFFF', ink: '#111111', monogram: 'A' },
  MSFT: { color: '#00A4EF', tile: '#FFFFFF', ink: '#111111', monogram: 'MS' },
  GOOGL: { color: '#FBBC05', tile: '#FFFFFF', ink: '#111111', monogram: 'G' },
  AMZN: { color: '#FF9900', tile: '#232F3E', ink: '#FF9900', monogram: 'a' },
  META: { color: '#0866FF', tile: '#FFFFFF', ink: '#0866FF', monogram: 'M' },
  TSLA: { color: '#E82127', tile: '#E82127', ink: '#FFFFFF', monogram: 'T' },
  SGOV: { color: '#2DD4BF', tile: '#0F3B36', ink: '#CCFBF1', monogram: 'T-BILL' },
  // Added 23 Sep. Each chart colour clears 3:1 against both grounds (#050505 dark, #F4EEE3 paper).
  MU: { color: '#12848F', tile: '#0B4F9C', ink: '#FFFFFF', monogram: 'MU' },
  SPCX: { color: '#3B82B8', tile: '#005288', ink: '#FFFFFF', monogram: 'SX' },
  CRCL: { color: '#8669AE', tile: '#6E4F9A', ink: '#FFFFFF', monogram: 'C' },
  USO: { color: '#B7791F', tile: '#3A2A10', ink: '#F5D9A8', monogram: 'OIL' },
  SLV: { color: '#7C8594', tile: '#2A2E35', ink: '#E5E7EB', monogram: 'Ag' },
  GME: { color: '#C8266B', tile: '#D2202F', ink: '#FFFFFF', monogram: 'GME' },
}

/** Cash, in every chart, is the quiet grey that says "waiting". */
export const CASH_LOOK: TokenLook = { color: '#6B6B73', tile: '#26262B', ink: '#D4D4D8', monogram: '$' }

export const lookOf = (symbol: string): TokenLook =>
  TOKEN_LOOK[symbol.toUpperCase()] ?? {
    color: '#8A8A93',
    tile: '#26262B',
    ink: '#E4E4E7',
    monogram: symbol.slice(0, 3),
  }

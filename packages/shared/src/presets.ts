/**
 * Starting points, so nobody faces an empty form (design brief 8.6). Named by SYMBOL here because this package
 * knows nothing about the chain. The caller resolves symbols to addresses against the approved list, and a
 * preset naming a symbol that is no longer approved simply fails to resolve.
 */
export interface Preset {
  id: string
  name: string
  description: string
  /** Who it suits, in a few words, shown on the card. */
  suits: string
  cashBps: number
  weights: Record<string, number>
}

export const PRESETS: Preset[] = [
  {
    id: 'broad-market',
    name: 'The whole US market',
    description:
      'Two funds that follow the 500 largest US companies and the Nasdaq 100. The steadiest mix here.',
    suits: 'A first desk',
    cashBps: 2000,
    weights: { SPY: 5000, QQQ: 3000 },
  },
  {
    id: 'big-tech',
    name: 'Big tech',
    description: 'Six of the largest technology companies, an equal share each.',
    suits: 'Tech, spread out',
    cashBps: 1600,
    weights: { NVDA: 1400, AAPL: 1400, MSFT: 1400, GOOGL: 1400, AMZN: 1400, META: 1400 },
  },
  {
    id: 'mag-seven',
    name: 'The 7 giants',
    description: 'Apple, Microsoft, Nvidia, Amazon, Alphabet, Meta and Tesla, an equal share each.',
    suits: 'The biggest names',
    cashBps: 1600,
    weights: { AAPL: 1200, MSFT: 1200, NVDA: 1200, AMZN: 1200, GOOGL: 1200, META: 1200, TSLA: 1200 },
  },
  {
    id: 'ai-builders',
    name: 'The companies building AI',
    description: 'The chips, cloud and models behind AI: Nvidia, Microsoft, Alphabet, Meta and Amazon.',
    suits: 'A bet on AI',
    cashBps: 2000,
    weights: { NVDA: 1600, MSFT: 1600, GOOGL: 1600, META: 1600, AMZN: 1600 },
  },
  {
    id: 'mostly-cash',
    name: 'Play it safe',
    description: 'Mostly cash, with a small slice of the whole US market.',
    suits: 'Trying it out',
    cashBps: 6000,
    weights: { SPY: 2500, QQQ: 1500 },
  },
]

export const presetById = (id: string): Preset | undefined => PRESETS.find((p) => p.id === id)

/** Defaults offered beside a preset. The owner can change every one. */
export const DEFAULT_LIMITS = {
  driftToleranceBps: 300,
  maxPositionBps: 5000,
  lossStopBps: 1500,
} as const

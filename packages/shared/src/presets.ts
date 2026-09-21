/**
 * Starting points, so nobody faces an empty form (design brief 8.6). Named by SYMBOL here because this package
 * knows nothing about the chain. The caller resolves symbols to addresses against the approved list, and a
 * preset naming a symbol that is no longer approved simply fails to resolve.
 */
export interface Preset {
  id: string
  name: string
  description: string
  cashBps: number
  weights: Record<string, number>
}

export const PRESETS: Preset[] = [
  {
    id: 'broad-market',
    name: 'Broad market',
    description: 'The S&P 500 and the Nasdaq 100 through two funds, with some cash kept aside.',
    cashBps: 2000,
    weights: { SPY: 5000, QQQ: 3000 },
  },
  {
    id: 'big-tech',
    name: 'Big tech',
    description: 'Six large technology companies in equal measure, with some cash kept aside.',
    cashBps: 1600,
    weights: { NVDA: 1400, AAPL: 1400, MSFT: 1400, GOOGL: 1400, AMZN: 1400, META: 1400 },
  },
  {
    id: 'mostly-cash',
    name: 'Mostly cash',
    description: 'Mostly cash, with a small broad-market holding.',
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

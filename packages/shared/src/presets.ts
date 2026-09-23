/**
 * Starting points, so nobody faces an empty form (design brief 8.6). Named by SYMBOL here because this package
 * knows nothing about the chain. The caller resolves symbols to addresses against the approved list, and a
 * preset naming a symbol that is no longer approved simply fails to resolve.
 *
 * Every preset uses only tokens that passed the liquidity scan of 23 Sep 2026 (pool at least $100k, round trip
 * at $1,000 at most 0.75%). `pnpm strategies:verify` re-checks them on mainnet and fails on any that slipped.
 * The first five ids are stored in mandates: never rename or remove them.
 */
export type PresetTag = 'broad' | 'tech' | 'ai' | 'commodities' | 'safe' | 'bold'

/** The filter chips, in the order they show. */
export const PRESET_TAGS: PresetTag[] = ['broad', 'tech', 'ai', 'commodities', 'safe', 'bold']

export interface Preset {
  id: string
  name: string
  description: string
  /** Who it's for, in a few words, shown on the card. */
  suits: string
  cashBps: number
  weights: Record<string, number>
  /** For the filter chips. */
  tags: PresetTag[]
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
    tags: ['broad', 'safe'],
  },
  {
    id: 'big-tech',
    name: 'Big tech',
    description: 'Five of the largest technology companies, an equal share each.',
    suits: 'Tech, spread out',
    cashBps: 1500,
    weights: { NVDA: 1700, AAPL: 1700, MSFT: 1700, GOOGL: 1700, AMZN: 1700 },
    tags: ['tech'],
  },
  {
    id: 'mag-seven',
    name: 'The giants',
    description:
      'Apple, Microsoft, Nvidia, Amazon, Alphabet and Tesla, an equal share each. Meta joins when its market here is deep enough again.',
    suits: 'The biggest names',
    cashBps: 1600,
    weights: { AAPL: 1400, MSFT: 1400, NVDA: 1400, AMZN: 1400, GOOGL: 1400, TSLA: 1400 },
    tags: ['tech'],
  },
  {
    id: 'ai-builders',
    name: 'The companies building AI',
    description: 'The chips, cloud and models behind AI: Nvidia, Microsoft, Alphabet and Amazon.',
    suits: 'A bet on AI',
    cashBps: 2000,
    weights: { NVDA: 2000, MSFT: 2000, GOOGL: 2000, AMZN: 2000 },
    tags: ['ai', 'tech'],
  },
  {
    id: 'mostly-cash',
    name: 'Play it safe',
    description: 'Mostly cash, with a small slice of the whole US market.',
    suits: 'Trying it out',
    cashBps: 6000,
    weights: { SPY: 2500, QQQ: 1500 },
    tags: ['safe', 'broad'],
  },
  {
    id: 'chips',
    name: 'Chips',
    description:
      'Nvidia, which designs the chips AI runs on, and Micron, which makes the memory beside them.',
    suits: 'A bet on chip makers',
    cashBps: 2000,
    weights: { NVDA: 4000, MU: 4000 },
    tags: ['tech', 'ai', 'bold'],
  },
  {
    id: 'space-frontier',
    name: 'Space and frontier',
    description: 'SpaceX, the rocket and satellite company, beside Tesla. Both can swing a lot in a day.',
    suits: 'Long-shot believers',
    cashBps: 2000,
    weights: { SPCX: 4500, TSLA: 3500 },
    tags: ['bold'],
  },
  {
    id: 'oil-silver',
    name: 'Oil and silver',
    description: 'Two funds that follow the price of crude oil and of silver, an equal share each.',
    suits: 'Real things, not companies',
    cashBps: 2000,
    weights: { USO: 4000, SLV: 4000 },
    tags: ['commodities'],
  },
  {
    id: 'crypto-rails',
    name: 'Crypto rails',
    description: 'Circle, the company behind the USDC stablecoin, with half kept as cash.',
    suits: 'A careful bet on crypto',
    cashBps: 5000,
    weights: { CRCL: 5000 },
    tags: ['bold'],
  },
  {
    id: 'retail-favourites',
    name: 'Crowd favourites',
    description:
      'GameStop and Tesla, two companies with huge followings among individual investors. Big swings, so 40% stays as cash.',
    suits: 'Following the crowd',
    cashBps: 4000,
    weights: { GME: 3000, TSLA: 3000 },
    tags: ['bold'],
  },
  {
    id: 't-bills',
    name: 'Cash-like: T-bills',
    description: 'A fund of US Treasury bills that mature within three months. It moves very little.',
    suits: 'Parking money',
    cashBps: 1000,
    weights: { SGOV: 9000 },
    tags: ['safe'],
  },
  {
    id: 'nasdaq-only',
    name: 'Nasdaq only',
    description: 'One fund that follows the 100 largest companies on the Nasdaq, most of them in tech.',
    suits: 'One fund, tech-leaning',
    cashBps: 1000,
    weights: { QQQ: 9000 },
    tags: ['broad', 'tech'],
  },
  {
    id: 'sp500-only',
    name: 'S&P 500 only',
    description: 'One fund that follows the 500 largest US companies.',
    suits: 'One fund, the whole market',
    cashBps: 1000,
    weights: { SPY: 9000 },
    tags: ['broad'],
  },
  {
    id: 'ai-software',
    name: 'AI software',
    description: 'Microsoft and Alphabet, whose cloud and models sell AI to other companies.',
    suits: 'AI without the chips',
    cashBps: 2000,
    weights: { MSFT: 4000, GOOGL: 4000 },
    tags: ['ai', 'tech'],
  },
  {
    id: 'consumer-giants',
    name: 'Consumer giants',
    description: 'Amazon and Apple, the shop and the phone most people use every day.',
    suits: 'Brands you know',
    cashBps: 2000,
    weights: { AMZN: 4000, AAPL: 4000 },
    tags: ['tech'],
  },
  {
    id: 'hard-assets-cash',
    name: 'Hard assets and cash',
    description: 'Half in Treasury bills, with oil and silver funds beside them.',
    suits: 'Worried about inflation',
    cashBps: 1000,
    weights: { SGOV: 5000, USO: 2000, SLV: 2000 },
    tags: ['commodities', 'safe'],
  },
  {
    id: 'momentum',
    name: 'Where the trading is',
    description:
      'The rule: the three single companies with the most money in their Robinhood Chain markets on 23 Sep 2026, over $1 million each. That was Nvidia, SpaceX and Circle. Chosen by activity, not by past returns.',
    suits: 'Following the money',
    cashBps: 1000,
    weights: { NVDA: 3000, SPCX: 3000, CRCL: 3000 },
    tags: ['bold'],
  },
  {
    id: 'defensive-half-cash',
    name: 'Defensive, half cash',
    description: 'Half cash, a quarter in Treasury bills, and the rest in the two broad funds.',
    suits: 'Nervous about the market',
    cashBps: 5000,
    weights: { SGOV: 2500, SPY: 1500, QQQ: 1000 },
    tags: ['safe', 'broad'],
  },
  {
    id: 'equal-weight',
    name: 'A bit of everything',
    description: 'Every Stock Token that passed our liquidity check, the same share each: 15 names at 6%.',
    suits: 'No favourites',
    cashBps: 1000,
    weights: {
      SPY: 600,
      QQQ: 600,
      NVDA: 600,
      AAPL: 600,
      MSFT: 600,
      GOOGL: 600,
      AMZN: 600,
      TSLA: 600,
      SGOV: 600,
      MU: 600,
      SPCX: 600,
      CRCL: 600,
      USO: 600,
      SLV: 600,
      GME: 600,
    },
    tags: ['broad'],
  },
  {
    id: 'barbell',
    name: 'Barbell',
    description: 'Most of it in Treasury bills, with two bold names on the other end: Nvidia and Tesla.',
    suits: 'Safe core, bold edge',
    cashBps: 1000,
    weights: { SGOV: 6000, NVDA: 1500, TSLA: 1500 },
    tags: ['safe', 'bold'],
  },
]

export const presetById = (id: string): Preset | undefined => PRESETS.find((p) => p.id === id)

/** Defaults offered beside a preset. The owner can change every one. */
export const DEFAULT_LIMITS = {
  driftToleranceBps: 300,
  maxPositionBps: 5000,
  lossStopBps: 1500,
} as const

/**
 * The largest holding a preset needs allowed: the usual 50%, or more for a one-fund preset like "S&P 500 only".
 * Without it, picking such a preset would fail the mandate check at once.
 */
export const presetMaxPositionBps = (p: Preset): number =>
  Math.max(DEFAULT_LIMITS.maxPositionBps, ...Object.values(p.weights))

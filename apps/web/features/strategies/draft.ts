/**
 * The studio's draft, and the one conversion from it to a mandate. Pure, so the browser and the server run the
 * same code: the browser to show problems as they are typed, the server to check again before anything is saved.
 *
 * Percentages and dollars are kept as the strings the owner typed. Weights are basis points by symbol, because a
 * symbol is what the owner sees; the conversion resolves each one against the approved list.
 */
import {
  checkMandate,
  DEFAULT_LIMITS,
  Mandate,
  type Preset,
  presetMaxPositionBps,
  studioCopy,
} from '@desk/shared'

export interface StudioDraft {
  name: string
  /** A preset id, or null for a basket set by hand. */
  preset: string | null
  weights: Record<string, number>
  cashBps: number
  driftPct: string
  maxPositionPct: string
  lossStopPct: string
  perAction: string
  daily: string
  large: string
  notes: string
  /** Protective rules, as typed: a symbol, a fall in percent, a cut in percent. Older saved drafts have none. */
  rules?: DraftRule[]
  /** The USDG to put in at creation, in dollars as typed. '0' starts in practice with no money. Older drafts have none. */
  amount?: string
  /** True once the owner types a limit themselves. Until then the limits follow the amount. */
  limitsSet?: boolean
}

export interface DraftRule {
  symbol: string
  fallPct: string
  cutPct: string
  /** A row key while editing; never saved into the mandate. */
  key?: string
}

export interface DraftToken {
  symbol: string
  name: string
  address: string
  tradability: string
}

export const NOTES_MAX = 600

export function initialDraft(preset?: Preset): StudioDraft {
  return {
    name: '',
    preset: preset?.id ?? null,
    weights: preset ? { ...preset.weights } : {},
    cashBps: preset?.cashBps ?? 10_000,
    driftPct: String(DEFAULT_LIMITS.driftToleranceBps / 100),
    maxPositionPct: String((preset ? presetMaxPositionBps(preset) : DEFAULT_LIMITS.maxPositionBps) / 100),
    lossStopPct: String(DEFAULT_LIMITS.lossStopBps / 100),
    perAction: '10',
    daily: '50',
    large: '100',
    notes: '',
    rules: [],
    amount: '20',
  }
}

export const withPreset = (draft: StudioDraft, preset: Preset): StudioDraft => ({
  ...draft,
  preset: preset.id,
  weights: { ...preset.weights },
  cashBps: preset.cashBps,
  // A one-fund preset holds 90%: the largest holding allowed rises to fit it, and never falls below 50%.
  maxPositionPct: String(presetMaxPositionBps(preset) / 100),
})

/**
 * Limits sized to the money going in, while the owner has not set their own: one trade can cover the largest first
 * buy twice over, and one day can put the whole amount to work, so the first rebalance is never held back by a
 * default meant for someone else's balance. Never below $1, and the ask-first line never below one trade.
 */
export function limitsFor(d: StudioDraft): Pick<StudioDraft, 'perAction' | 'daily' | 'large'> {
  const amount = Number(d.amount) || 0
  if (amount <= 0) return { perAction: d.perAction, daily: d.daily, large: d.large }
  const widest = Math.max(0, ...Object.values(d.weights)) / 10_000
  const perAction = Math.max(1, Math.ceil(amount * widest * 2))
  const daily = Math.max(perAction, Math.ceil(amount))
  return { perAction: String(perAction), daily: String(daily), large: String(Math.max(100, perAction)) }
}

export const draftTotalBps = (d: StudioDraft) =>
  d.cashBps + Object.values(d.weights).reduce((a, b) => a + b, 0)

const pctToBps = (s: string) => Math.round(Number(s) * 100)

/** Dollars with at most six decimals, as USDG base units. Null when it is not a plain positive number. */
export function dollarsToUnits(s: string): bigint | null {
  const m = /^\s*(\d{1,9})(?:\.(\d{0,6}))?\s*$/.exec(s)
  if (!m) return null
  const units = BigInt(m[1] ?? '0') * 1_000_000n + BigInt((m[2] ?? '').padEnd(6, '0') || '0')
  return units > 0n ? units : null
}

export type DraftResult = { ok: true; mandate: Mandate } | { ok: false; problems: string[] }

/** The draft as a mandate, checked exactly as the server and the worker check one. */
export function draftToMandate(d: StudioDraft, tokens: DraftToken[]): DraftResult {
  const problems: string[] = []
  const bySymbol = new Map(tokens.map((t) => [t.symbol, t]))
  const targets = Object.entries(d.weights)
    .filter(([, bps]) => bps > 0)
    .map(([symbol, weightBps]) => {
      const t = bySymbol.get(symbol)
      if (!t) problems.push(`${symbol} is not on the approved list`)
      return { token: t?.address ?? symbol, weightBps }
    })
  const perAction = dollarsToUnits(d.perAction)
  const daily = dollarsToUnits(d.daily)
  const large = dollarsToUnits(d.large)
  if (!perAction || !daily || !large) problems.push('each limit needs an amount in dollars')
  if (d.notes.length > NOTES_MAX) problems.push(`the notes are longer than ${NOTES_MAX} characters`)
  const rules = (d.rules ?? []).map((r, i) => {
    const t = bySymbol.get(r.symbol)
    if (!t) problems.push(`${r.symbol} is not on the approved list`)
    return {
      id: `rule${i + 1}`,
      kind: 'price_move_sell' as const,
      token: t?.address ?? r.symbol,
      fallBps: pctToBps(r.fallPct),
      cutBps: pctToBps(r.cutPct),
    }
  })
  if (problems.length > 0) return { ok: false, problems }
  const parsed = Mandate.safeParse({
    preset: d.preset,
    targets: { cashBps: d.cashBps, tokens: targets },
    driftToleranceBps: pctToBps(d.driftPct),
    maxPositionBps: pctToBps(d.maxPositionPct),
    lossStopBps: pctToBps(d.lossStopPct),
    perActionCapUsdg: perAction,
    dailyCapUsdg: daily,
    largeActionUsdg: large,
    notes: d.notes.trim(),
    ...(rules.length > 0 ? { rules } : {}),
  })
  if (!parsed.success)
    return {
      ok: false,
      problems: [
        parsed.error.issues.some((i) => i.path[0] === 'rules')
          ? 'a rule is outside its bounds: a fall of 1% to 20%, selling 10% to all of it'
          : 'a percentage is outside 0 to 100',
      ],
    }
  const checked = checkMandate(
    parsed.data,
    tokens.map((t) => ({ address: t.address, displayName: t.name })),
  )
  if (perAction && daily && daily < perAction && !checked.some((p) => p.includes('daily'))) {
    checked.push(studioCopy.behaviour.dailyBelow)
  }
  return checked.length > 0 ? { ok: false, problems: checked } : { ok: true, mandate: parsed.data }
}

/** A mandate as JSON, amounts as strings: the shape the worker's test read and the server both read. */
export function mandateJson(m: Mandate): Record<string, unknown> {
  return {
    ...m,
    perActionCapUsdg: m.perActionCapUsdg.toString(),
    dailyCapUsdg: m.dailyCapUsdg.toString(),
    largeActionUsdg: m.largeActionUsdg.toString(),
  }
}

/** The JSON back into a mandate. The schema is the last word, whatever the browser sent. */
export function mandateFromJson(json: unknown): Mandate {
  const m = (json ?? {}) as Record<string, unknown>
  const big = (v: unknown) => (typeof v === 'string' && /^\d+$/.test(v) ? BigInt(v) : v)
  return Mandate.parse({
    ...m,
    perActionCapUsdg: big(m.perActionCapUsdg),
    dailyCapUsdg: big(m.dailyCapUsdg),
    largeActionUsdg: big(m.largeActionUsdg),
  })
}

/** One stable string per mandate, so a test read can be matched to the draft it read. */
export function mandateKey(m: Mandate): string {
  const tokens = m.targets.tokens
    .map((t) => [t.token.toLowerCase(), t.weightBps] as const)
    .sort((a, b) => a[0].localeCompare(b[0]))
  return JSON.stringify([
    m.preset,
    m.targets.cashBps,
    tokens,
    m.driftToleranceBps,
    m.maxPositionBps,
    m.lossStopBps,
    m.perActionCapUsdg.toString(),
    m.dailyCapUsdg.toString(),
    m.largeActionUsdg.toString(),
    m.notes,
    (m.rules ?? []).map((r) => [r.token.toLowerCase(), r.fallBps, r.cutBps] as const),
  ])
}

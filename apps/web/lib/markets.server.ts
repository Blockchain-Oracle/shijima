/**
 * The markets page and the stock pages, read from Postgres: the price log, what shared desks decided, the
 * multiplier changes and the report dates. Nothing here reads the chain or holds a key.
 *
 * A strategy's chart is computed, not stored. $1,000 is put in at the start of the period at the strategy's
 * weights: each stock's share grows with its pool price, the cash share stays cash. The reference line is the
 * same basket valued at each stock's reference at that moment, so it steps when a new close is set. The gap
 * between the two lines is the gap the desks weigh, for the basket as a whole.
 */
import { APPROVED_TOKENS, type ApprovedToken } from '@desk/chain'
import {
  companyEventsFrom,
  desksOfOwner,
  latestPricePoints,
  multiplierHistory,
  ownerAlerts,
  type PriceAlertRow,
  pricesBetween,
  sharedDecisionsOn,
  sharedDesks,
} from '@desk/db'
import { ago, marketsCopy, newYorkTime, PRESETS, type Preset, stockCopy } from '@desk/shared'
import type { Route } from 'next'
import { db } from './db'
import { signedInAddress } from './session'

const DAY = 86_400_000
export const RANGES = { '1D': DAY, '1W': 7 * DAY, '1M': 30 * DAY } as const
export type Range = keyof typeof RANGES
export const parseRange = (v: string | undefined): Range => (v && v in RANGES ? (v as Range) : '1W')

/** The logger writes every five minutes. Older than fifteen means it has stopped. */
const STALE_MS = 15 * 60 * 1000
/** A phone draws this many points at once; more adds nothing a person can see. */
const MAX_POINTS = 360

const byAddress = (address: string) =>
  APPROVED_TOKENS.find((t) => t.address.toLowerCase() === address.toLowerCase())
export const bySymbol = (symbol: string) => APPROVED_TOKENS.find((t) => t.symbol === symbol.toUpperCase())

// ---------------------------------------------------------------- one token now

export interface TokenNow {
  symbol: string
  name: string
  price: number | null
  reference: number | null
  referenceKind: string | null
  referenceAt: Date | null
  officialAt: Date | null
  gapBps: number | null
  costBps100: number | null
  costBps1000: number | null
  halted: boolean | null
  at: Date
}

async function tokensNow(): Promise<TokenNow[]> {
  const rows = await latestPricePoints(db())
  return APPROVED_TOKENS.flatMap((t) => {
    const p = rows.find((r) => r.token === t.address.toLowerCase())
    if (!p) return []
    return [
      {
        symbol: t.symbol,
        name: t.displayName,
        price: p.poolMidE8 === null ? null : Number(p.poolMidE8) / 1e8,
        reference: p.referenceE8 === null ? null : Number(p.referenceE8) / 1e8,
        referenceKind: p.referenceKind,
        referenceAt: p.referenceAt,
        officialAt: p.feedUpdatedAt,
        gapBps: p.referenceE8 === null ? null : p.gapBps,
        costBps100: p.costBps100,
        costBps1000: p.costBps1000,
        halted: p.halted,
        at: p.at,
      },
    ]
  })
}

/** "the pools at the last regular close, Fri 16:00 New York" or "the last official update, 3 minutes ago". */
function referenceWords(t: TokenNow, one = false): string {
  if (t.referenceKind === 'last_regular_close' && t.referenceAt)
    return (one ? stockCopy.caption.referenceClose : marketsCopy.caption.referenceClose)(
      newYorkTime(t.referenceAt),
    )
  return marketsCopy.caption.referenceOfficial(t.officialAt ? ago(t.officialAt) : 'recently')
}

/** What trading `usd` of one token costs now, from the nearer of the two logged quote sizes. */
function tradeCost(t: TokenNow, usd: number): number | null {
  const bps = usd <= 316 ? t.costBps100 : t.costBps1000
  return bps === null ? null : (usd * bps) / 10_000
}

// ---------------------------------------------------------------- series

export interface Point {
  /** Seconds since 1970. */
  time: number
  value: number
  reference: number | null
}

function thin<T>(points: T[], max = MAX_POINTS): T[] {
  if (points.length <= max) return points
  const step = Math.ceil(points.length / max)
  return points.filter((_, i) => i % step === 0 || i === points.length - 1)
}

type PriceRow = Awaited<ReturnType<typeof pricesBetween>>[number]

/**
 * $1,000 at the preset's weights, through time. Prices are carried forward between rows, and the basket starts
 * at the first moment every member has a price.
 */
function basketSeries(rows: PriceRow[], members: { address: string; weightBps: number }[], cashBps: number) {
  const last = new Map<string, { p: number; r: number | null }>()
  const start = new Map<string, number>()
  const points: Point[] = []
  let i = 0
  while (i < rows.length) {
    const at = rows[i]?.at.getTime() ?? 0
    for (; i < rows.length && rows[i]?.at.getTime() === at; i++) {
      const row = rows[i] as PriceRow
      if (row.poolMidE8 === null) continue
      last.set(row.token, {
        p: Number(row.poolMidE8) / 1e8,
        r: row.referenceE8 === null ? null : Number(row.referenceE8) / 1e8,
      })
    }
    if (!members.every((m) => last.has(m.address))) continue
    if (start.size === 0) for (const m of members) start.set(m.address, last.get(m.address)?.p ?? 1)
    let value = cashBps / 10_000
    let reference: number | null = cashBps / 10_000
    for (const m of members) {
      const now = last.get(m.address)
      const p0 = start.get(m.address) ?? 1
      if (!now) continue
      value += (m.weightBps / 10_000) * (now.p / p0)
      reference =
        reference === null || now.r === null ? null : reference + (m.weightBps / 10_000) * (now.r / p0)
    }
    points.push({
      time: Math.floor(at / 1000),
      value: value * 1000,
      reference: reference === null ? null : reference * 1000,
    })
  }
  return thin(points)
}

function tokenSeries(rows: PriceRow[], address: string): Point[] {
  return thin(
    rows
      .filter((r) => r.token === address && r.poolMidE8 !== null)
      .map((r) => ({
        time: Math.floor(r.at.getTime() / 1000),
        value: Number(r.poolMidE8) / 1e8,
        reference: r.referenceE8 === null ? null : Number(r.referenceE8) / 1e8,
      })),
  )
}

// ---------------------------------------------------------------- what desks did

export interface DeskMark {
  id: string
  /** Seconds since 1970, snapped onto a point of the series it marks. */
  time: number
  at: string
  kind: 'acted' | 'waited' | 'declined' | 'practice'
  side: 'buy' | 'sell' | null
  symbol: string
  href: string
  line: string
  outcome: string
  summary: string
}

type SharedDecision = Awaited<ReturnType<typeof sharedDecisionsOn>>[number]

/**
 * A desk that waits re-checks every hour and writes "waited" each time. On a chart that is one choice, so a run
 * of the same outcome on the same desk and stock is marked once, where it began.
 */
function firstOfRuns(decisions: SharedDecision[]): SharedDecision[] {
  const previous = new Map<string, string>()
  return decisions.filter((d) => {
    const key = `${d.deskId}:${d.token}`
    const same = previous.get(key) === d.outcome
    previous.set(key, d.outcome)
    return !same
  })
}

const markKind = (outcome: string, shadow: boolean): DeskMark['kind'] =>
  outcome === 'would_have_acted' || (shadow && outcome.startsWith('acted'))
    ? 'practice'
    : outcome.startsWith('acted')
      ? 'acted'
      : outcome === 'declined'
        ? 'declined'
        : 'waited'

function toMarks(decisions: SharedDecision[], times: number[]): DeskMark[] {
  return firstOfRuns(decisions).flatMap((d) => {
    const token = d.token ? byAddress(d.token) : undefined
    if (!token || !d.shareSlug) return []
    const t = Math.floor(d.decidedAt.getTime() / 1000)
    // A marker must sit on a point of the series: the last one at or before the decision.
    let snapped = times[0] ?? t
    for (const time of times) if (time <= t) snapped = time
    const outcome = marketsCopy.outcomes[d.outcome] ?? d.outcome
    return [
      {
        id: `${d.deskId}:${d.seq}`,
        time: snapped,
        at: d.decidedAt.toISOString(),
        kind: markKind(d.outcome, d.shadow),
        side: d.side === 'buy' || d.side === 'sell' ? d.side : null,
        symbol: token.symbol,
        href: `/desk/${d.shareSlug}/decision/${d.seq}`,
        line: marketsCopy.decisionLine(d.deskName ?? 'A desk', outcome, d.side, token.displayName),
        outcome,
        summary: d.summary,
      },
    ]
  })
}

// ---------------------------------------------------------------- who is looking

export interface Viewer {
  address: string | null
  /** The viewer's own desk, where "Ask about this" and alerts go. */
  desk: { id: string; slug: string } | null
}

async function viewer(): Promise<Viewer> {
  const address = (await signedInAddress().catch(() => undefined)) ?? null
  if (!address) return { address: null, desk: null }
  const [desk] = await desksOfOwner(db(), address)
  return { address, desk: desk ? { id: desk.id, slug: desk.shareSlug ?? desk.id } : null }
}

export const askHref = (v: Viewer, question: string): Route | null =>
  v.desk ? (`/desk/${v.desk.slug}?ask=${encodeURIComponent(question)}` as Route) : null

// ---------------------------------------------------------------- the markets page

export interface StrategyView {
  preset: Preset
  points: Point[]
  marks: DeskMark[]
  valueNow: number | null
  gapBps: number | null
  startedAt: Date | null
  members: { symbol: string; name: string; weightBps: number; gapBps: number | null; halted: boolean }[]
  costUsd: number | null
  caption: string
  nextReport: string | null
  halted: string[]
}

export interface MarketsView {
  tokens: TokenNow[]
  asOf: Date | null
  stale: boolean
  range: Range
  strategy: StrategyView | null
  sparks: Record<string, Point[]>
  marks: DeskMark[]
  desks: Awaited<ReturnType<typeof sharedDesks>>
  viewer: Viewer
}

const nyDay = (at: Date) =>
  at.toLocaleDateString('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })

export const periodStart = (range: Range, at: Date) => (range === '1D' ? newYorkTime(at) : nyDay(at))

const timingWords = (timing: string | null) => (timing ? stockCopy.sections.events.timing[timing] : null)
const reportWhen = (date: string, timing: string | null) => {
  const day = new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
  const t = timingWords(timing)
  return t ? `${day}, ${t}` : day
}

function strategyFrom(
  preset: Preset,
  rows: PriceRow[],
  tokens: TokenNow[],
  decisions: SharedDecision[],
  events: Awaited<ReturnType<typeof companyEventsFrom>>,
): StrategyView | null {
  const members = Object.entries(preset.weights).flatMap(([symbol, weightBps]) => {
    const token = bySymbol(symbol)
    return token ? [{ token, weightBps }] : []
  })
  if (members.length === 0) return null
  const points = basketSeries(
    rows,
    members.map((m) => ({ address: m.token.address.toLowerCase(), weightBps: m.weightBps })),
    preset.cashBps,
  )
  const nowOf = (t: ApprovedToken) => tokens.find((n) => n.symbol === t.symbol)
  const rowsNow = members.map((m) => ({ ...m, now: nowOf(m.token) }))
  const last = points.at(-1)
  const gapBps =
    last?.reference && last.reference > 0 ? Math.round((last.value / last.reference - 1) * 10_000) : null

  const addresses = new Set(members.map((m) => m.token.address.toLowerCase()))
  const marks = toMarks(
    decisions.filter((d) => d.token && addresses.has(d.token)),
    points.map((p) => p.time),
  )

  let cost: number | null = 0
  for (const m of rowsNow) {
    const c = m.now ? tradeCost(m.now, (500 * m.weightBps) / 10_000) : null
    cost = cost === null || c === null ? null : cost + c
  }
  const halted = rowsNow.filter((m) => m.now?.halted).map((m) => m.token.displayName)

  const mover = rowsNow
    .filter((m) => m.now?.gapBps !== null && m.now?.gapBps !== undefined)
    .sort((a, b) => Math.abs(b.now?.gapBps ?? 0) - Math.abs(a.now?.gapBps ?? 0))[0]
  const first = rowsNow.find((m) => m.now)?.now
  const c = marketsCopy.caption
  const acted = marks.filter((m) => m.kind === 'acted').length
  const waited = marks.filter((m) => m.kind === 'waited').length
  const caption = [
    gapBps === null || !first ? '' : c.gap(preset.name, gapBps, referenceWords(first)),
    mover?.now?.gapBps !== undefined &&
    mover.now.gapBps !== null &&
    Math.abs(mover.now.gapBps) >= 50 &&
    members.length > 1
      ? c.mover(mover.token.displayName, mover.now.gapBps)
      : '',
    gapBps !== null && Math.abs(gapBps) < 50 ? c.noise : '',
    halted.length > 0 ? c.halted(halted.join(' and ')) : '',
    c.desks(acted, waited),
  ]
    .filter(Boolean)
    .join(' ')

  const next = events.find((e) => addresses.has(e.token))
  const nextToken = next ? byAddress(next.token) : undefined
  return {
    preset,
    points,
    marks,
    valueNow: last?.value ?? null,
    gapBps,
    startedAt: points[0] ? new Date(points[0].time * 1000) : null,
    members: rowsNow.map((m) => ({
      symbol: m.token.symbol,
      name: m.token.displayName,
      weightBps: m.weightBps,
      gapBps: m.now?.gapBps ?? null,
      halted: m.now?.halted === true,
    })),
    costUsd: cost,
    caption,
    nextReport:
      next && nextToken
        ? marketsCopy.rail.report(nextToken.displayName, reportWhen(next.eventDate, next.timing))
        : null,
    halted,
  }
}

export async function loadMarkets(presetId: string | undefined, range: Range): Promise<MarketsView> {
  const now = new Date()
  const from = new Date(now.getTime() - RANGES[range])
  const today = now.toISOString().slice(0, 10)
  const [tokens, rows, decisions, events, desks, who] = await Promise.all([
    tokensNow(),
    pricesBetween(db(), from, now),
    sharedDecisionsOn(
      db(),
      APPROVED_TOKENS.map((t) => t.address),
      from,
    ),
    companyEventsFrom(db(), today),
    sharedDesks(db()),
    viewer(),
  ])
  const preset =
    PRESETS.find((p) => p.id === presetId) ?? PRESETS.find((p) => p.id === 'mag-seven') ?? PRESETS[0]
  const strategy = preset ? strategyFrom(preset, rows, tokens, decisions, events) : null

  // Each card's line runs from a little before its reference was set, and covers at least a day.
  const sparks: Record<string, Point[]> = {}
  for (const t of tokens) {
    const address = bySymbol(t.symbol)?.address.toLowerCase() ?? ''
    const since = Math.min((t.referenceAt?.getTime() ?? now.getTime()) - 2 * 3_600_000, now.getTime() - DAY)
    sparks[t.symbol] = tokenSeries(
      rows.filter((r) => r.at.getTime() >= since),
      address,
    ).slice(-120)
  }

  const asOf = tokens.reduce<Date | null>((m, t) => (m === null || t.at > m ? t.at : m), null)
  const allTimes = strategy?.points.map((p) => p.time) ?? []
  return {
    tokens,
    asOf,
    stale: asOf !== null && now.getTime() - asOf.getTime() > STALE_MS,
    range,
    strategy,
    sparks,
    marks: toMarks(decisions, allTimes).reverse(),
    desks,
    viewer: who,
  }
}

// ---------------------------------------------------------------- one stock

export interface StockView {
  token: ApprovedToken
  now: TokenNow | null
  stale: boolean
  range: Range
  points: Point[]
  marks: DeskMark[]
  decisions: DeskMark[]
  caption: string
  multiplier: {
    now: string
    changes: { at: Date; pct: string; kind: string }[]
    pending: { at: Date; to: string } | null
  }
  events: { date: string; when: string; label: string }[]
  nextReport: string | null
  alerts: PriceAlertRow[]
  viewer: Viewer
}

/** "+0.078%": how much one change raised the multiplier. */
function signedPct(before: bigint, after: bigint): string {
  if (before === 0n) return '—'
  const pct = (Number((after * 100_000_000n) / before) / 100_000_000 - 1) * 100
  return `${pct >= 0 ? '+' : '−'}${Math.abs(pct).toFixed(3)}%`
}

const sharesText = (raw: bigint) => (Number((raw * 1_000_000n) / 10n ** 18n) / 1_000_000).toFixed(6)

export async function loadStock(symbol: string, range: Range): Promise<StockView | undefined> {
  const token = bySymbol(symbol)
  if (!token) return undefined
  const now = new Date()
  const address = token.address.toLowerCase()
  const from = new Date(now.getTime() - RANGES[range])
  const today = now.toISOString().slice(0, 10)
  const [tokens, rows, inRange, allTime, history, events, who] = await Promise.all([
    tokensNow(),
    pricesBetween(db(), from, now),
    sharedDecisionsOn(db(), [address], from),
    sharedDecisionsOn(db(), [address], new Date(0)),
    multiplierHistory(db(), address),
    companyEventsFrom(db(), today, [address]),
    viewer(),
  ])
  const t = tokens.find((n) => n.symbol === token.symbol) ?? null
  const points = tokenSeries(rows, address)
  const marks = toMarks(
    inRange,
    points.map((p) => p.time),
  )

  const c = stockCopy.caption
  const cost1000 = t ? tradeCost(t, 1000) : null
  const caption = t
    ? [
        t.gapBps === null ? '' : c.gap(token.displayName, t.gapBps, referenceWords(t, true)),
        cost1000 === null ? '' : c.cost(`$${cost1000.toFixed(2)}`),
        t.halted ? c.halted : '',
      ]
        .filter(Boolean)
        .join(' ')
    : ''

  const applied = history.filter((h) => h.at <= now)
  const pending = history.find((h) => h.at > now)
  const current = applied[0]?.newMultiplierRaw ?? 10n ** 18n
  const alerts = who.address ? await ownerAlerts(db(), who.address, address) : []
  const reports = events.map((e) => {
    const payload = (e.payload ?? {}) as { quarter?: number | null; year?: number | null }
    return {
      date: e.eventDate,
      when: reportWhen(e.eventDate, e.timing),
      label:
        payload.quarter && payload.year
          ? stockCopy.sections.events.earnings(payload.quarter, payload.year)
          : stockCopy.sections.events.earningsPlain,
    }
  })
  return {
    token,
    now: t,
    stale: t !== null && now.getTime() - t.at.getTime() > STALE_MS,
    range,
    points,
    marks,
    decisions: toMarks(allTime, []).reverse().slice(0, 20),
    caption,
    multiplier: {
      now: sharesText(current),
      changes: applied.map((h) => ({
        at: h.at,
        pct: signedPct(h.oldMultiplierRaw, h.newMultiplierRaw),
        kind: stockCopy.sections.multiplier.kinds[h.kind] ?? h.kind,
      })),
      pending: pending ? { at: pending.at, to: sharesText(pending.newMultiplierRaw) } : null,
    },
    events: reports,
    nextReport: reports[0]?.when ?? null,
    alerts,
    viewer: who,
  }
}

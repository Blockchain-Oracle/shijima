/** Market facts shared by every desk. A close reference is computed from the chain once, then kept. */
import { and, asc, desc, eq, gte, inArray, lte, max, sql } from 'drizzle-orm'
import type { DbOrTx } from '../client'
import { companyEvents, decisions, desks, multiplierEvents, pricePoints, referenceSnapshots } from '../schema'

export type ReferenceRow = typeof referenceSnapshots.$inferSelect

export async function findReference(
  db: DbOrTx,
  token: string,
  kind: 'close' | 'open',
  sessionDate: string,
): Promise<ReferenceRow | undefined> {
  const [row] = await db
    .select()
    .from(referenceSnapshots)
    .where(
      and(
        eq(referenceSnapshots.token, token.toLowerCase()),
        eq(referenceSnapshots.kind, kind),
        eq(referenceSnapshots.sessionDate, sessionDate),
      ),
    )
  return row
}

export async function saveReference(
  db: DbOrTx,
  row: {
    token: string
    kind: 'close' | 'open'
    sessionDate: string
    boundaryAt: Date
    priceE8: bigint
    multiplierRaw: bigint
    txHash: string
    blockNumber: number
  },
): Promise<void> {
  await db
    .insert(referenceSnapshots)
    .values({ ...row, token: row.token.toLowerCase(), txHash: row.txHash.toLowerCase() })
    .onConflictDoNothing({
      target: [referenceSnapshots.token, referenceSnapshots.kind, referenceSnapshots.sessionDate],
    })
}

export type PricePointInsert = typeof pricePoints.$inferInsert
export type PricePointRow = typeof pricePoints.$inferSelect

/** Saves one moment's prices. A slot already written is left as it is, so a restart never writes twice. */
export async function savePricePoints(db: DbOrTx, rows: PricePointInsert[]): Promise<number> {
  if (rows.length === 0) return 0
  const written = await db
    .insert(pricePoints)
    .values(rows.map((r) => ({ ...r, token: r.token.toLowerCase() })))
    .onConflictDoNothing({ target: [pricePoints.token, pricePoints.at] })
    .returning({ id: pricePoints.id })
  return written.length
}

/** True when any token already has a row for this moment. */
export async function priceSlotWritten(db: DbOrTx, at: Date): Promise<boolean> {
  const [row] = await db
    .select({ id: pricePoints.id })
    .from(pricePoints)
    .where(eq(pricePoints.at, at))
    .limit(1)
  return Boolean(row)
}

/** The tokens (lowercase addresses) that already have a row for this moment. */
export async function tokensPricedAt(db: DbOrTx, at: Date): Promise<Set<string>> {
  const rows = await db.select({ token: pricePoints.token }).from(pricePoints).where(eq(pricePoints.at, at))
  return new Set(rows.map((r) => r.token))
}

/** One token's prices between two moments, oldest first: what a chart draws. */
export async function priceSeries(db: DbOrTx, token: string, from: Date, to: Date): Promise<PricePointRow[]> {
  return db
    .select()
    .from(pricePoints)
    .where(
      and(eq(pricePoints.token, token.toLowerCase()), gte(pricePoints.at, from), lte(pricePoints.at, to)),
    )
    .orderBy(asc(pricePoints.at))
}

/** The newest row for every token: what the ticker and the stock cards show. */
export async function latestPricePoints(db: DbOrTx): Promise<PricePointRow[]> {
  return db
    .selectDistinctOn([pricePoints.token])
    .from(pricePoints)
    .orderBy(pricePoints.token, desc(pricePoints.at))
}

/** Every token's prices between two moments, oldest first, with only what a chart and a card read. */
export async function pricesBetween(db: DbOrTx, from: Date, to: Date) {
  return db
    .select({
      token: pricePoints.token,
      at: pricePoints.at,
      poolMidE8: pricePoints.poolMidE8,
      referenceE8: pricePoints.referenceE8,
    })
    .from(pricePoints)
    .where(and(gte(pricePoints.at, from), lte(pricePoints.at, to)))
    .orderBy(asc(pricePoints.at))
}

// ---------------------------------------------------------------- multipliers

export type MultiplierEventInsert = typeof multiplierEvents.$inferInsert

/** The newest block already read for multiplier changes, so the next read starts after it. */
export async function lastMultiplierBlock(db: DbOrTx): Promise<number | null> {
  const [row] = await db.select({ block: max(multiplierEvents.blockNumber) }).from(multiplierEvents)
  return row?.block ?? null
}

export async function saveMultiplierEvents(db: DbOrTx, rows: MultiplierEventInsert[]): Promise<number> {
  if (rows.length === 0) return 0
  const written = await db
    .insert(multiplierEvents)
    .values(rows.map((r) => ({ ...r, token: r.token.toLowerCase(), txHash: r.txHash.toLowerCase() })))
    .onConflictDoNothing({ target: [multiplierEvents.txHash, multiplierEvents.logIndex] })
    .returning({ id: multiplierEvents.id })
  return written.length
}

/** One token's multiplier changes, newest first. */
export async function multiplierHistory(db: DbOrTx, token: string) {
  return db
    .select()
    .from(multiplierEvents)
    .where(eq(multiplierEvents.token, token.toLowerCase()))
    .orderBy(desc(multiplierEvents.at))
}

// ---------------------------------------------------------------- company events

export type CompanyEventInsert = typeof companyEvents.$inferInsert

/** Saves the calendar. A date already known is refreshed, since a company can move its report. */
export async function saveCompanyEvents(db: DbOrTx, rows: CompanyEventInsert[]): Promise<number> {
  if (rows.length === 0) return 0
  const written = await db
    .insert(companyEvents)
    .values(rows.map((r) => ({ ...r, token: r.token.toLowerCase() })))
    .onConflictDoUpdate({
      target: [companyEvents.token, companyEvents.kind, companyEvents.eventDate],
      set: { timing: sql`excluded.timing`, payload: sql`excluded.payload`, fetchedAt: sql`now()` },
    })
    .returning({ id: companyEvents.id })
  return written.length
}

/** Company events from a date on, soonest first. `tokens` narrows it; empty means every token. */
export async function companyEventsFrom(db: DbOrTx, fromDate: string, tokens: string[] = []) {
  const since = gte(companyEvents.eventDate, fromDate)
  return db
    .select()
    .from(companyEvents)
    .where(
      tokens.length === 0
        ? since
        : and(
            since,
            inArray(
              companyEvents.token,
              tokens.map((t) => t.toLowerCase()),
            ),
          ),
    )
    .orderBy(asc(companyEvents.eventDate))
}

// ---------------------------------------------------------------- what shared desks did

/** The outcomes a chart marks. A quiet "nothing to do" or a failure is not something a desk did. */
export const MARKED_OUTCOMES = [
  'acted',
  'acted_in_part',
  'acted_by_override',
  'waited',
  'declined',
  'would_have_acted',
] as const

/**
 * What desks with sharing on decided about these tokens since a moment, oldest first. Public columns only: the
 * desk's name and share link, never its owner.
 */
export async function sharedDecisionsOn(db: DbOrTx, tokens: string[], from: Date, limit = 400) {
  if (tokens.length === 0) return []
  return db
    .select({
      seq: decisions.seq,
      outcome: decisions.outcome,
      token: decisions.token,
      side: decisions.side,
      amountUsdg: decisions.amountUsdg,
      shadow: decisions.shadow,
      summary: decisions.summary,
      decidedAt: decisions.decidedAt,
      deskId: desks.id,
      deskName: desks.name,
      shareSlug: desks.shareSlug,
    })
    .from(decisions)
    .innerJoin(desks, eq(decisions.deskId, desks.id))
    .where(
      and(
        sql`not (${desks.lifecycle} = 'onboarding' and ${desks.deployedAt} is null)`,
        inArray(
          decisions.token,
          tokens.map((t) => t.toLowerCase()),
        ),
        inArray(decisions.outcome, [...MARKED_OUTCOMES]),
        gte(decisions.decidedAt, from),
      ),
    )
    .orderBy(asc(decisions.decidedAt))
    .limit(limit)
}

/**
 * The weekend fact for the first-run tutorial: on the latest weekend in the price log, while the US market was
 * shut, the largest distance any Stock Token's pool moved from its Friday reference. Measured on the logged gap
 * against `last_regular_close`, so it is the engine's own reference and never a claim about Monday.
 */
export async function latestWeekendMove(
  db: DbOrTx,
): Promise<{ token: string; gapBps: number; saturday: string } | undefined> {
  const rows = await db.execute<{ token: string; gap_bps: number; saturday: string }>(sql`
    with weekend as (
      select token, gap_bps, (${pricePoints.at} at time zone 'America/New_York')::date as day
      from ${pricePoints}
      where extract(isodow from (${pricePoints.at} at time zone 'America/New_York')) in (6, 7)
        and ${pricePoints.referenceKind} = 'last_regular_close'
        and ${pricePoints.gapBps} is not null
        and ${pricePoints.at} > now() - interval '21 days'
    ),
    latest as (select max(day) - (extract(isodow from max(day))::int - 6) as saturday from weekend)
    select w.token, w.gap_bps, l.saturday::text as saturday
    from weekend w, latest l
    where w.day between l.saturday and l.saturday + 1
    order by abs(w.gap_bps) desc
    limit 1`)
  const row = rows.rows[0]
  return row ? { token: row.token, gapBps: Number(row.gap_bps), saturday: row.saturday } : undefined
}

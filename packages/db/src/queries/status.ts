/**
 * What the Status page reads: whether the worker is alive and turning, what started the last hourly checks, how
 * the outside sources last answered, and each visible desk's last check. Every figure is read at request time
 * from rows the product already writes; nothing here is a cached verdict.
 */
import { eq, sql } from 'drizzle-orm'
import type { DbOrTx } from '../client'
import { workerBeats } from '../schema'

/**
 * The session advisory lock the worker holds for its whole life (apps/worker/src/leader.ts). Any fixed number;
 * every worker of this product asks for the same one. It lives here so Status can look for it in `pg_locks`.
 */
export const LEADER_LOCK_KEY = 4663_001
export const WORKER_NAME = 'worker'

export type WorkerBeat = typeof workerBeats.$inferSelect

/** Called once when the worker has the lock: a fresh start, with what this process runs. */
export async function startWorkerBeat(db: DbOrTx, info: Record<string, unknown>): Promise<void> {
  const now = new Date()
  await db
    .insert(workerBeats)
    .values({ name: WORKER_NAME, startedAt: now, beatAt: now, passes: 0, info })
    .onConflictDoUpdate({
      target: workerBeats.name,
      set: { startedAt: now, beatAt: now, passes: 0, lastPassMs: null, lastError: null, info },
    })
}

/** Called after every pass of the loop, good or bad. `info` is merged into what the start wrote. */
export async function recordWorkerPass(
  db: DbOrTx,
  pass: { ms: number; error?: string; info?: Record<string, unknown> },
): Promise<void> {
  await db
    .update(workerBeats)
    .set({
      beatAt: new Date(),
      passes: sql`${workerBeats.passes} + 1`,
      lastPassMs: pass.ms,
      lastError: pass.error ?? null,
      ...(pass.info
        ? { info: sql`coalesce(${workerBeats.info}, '{}'::jsonb) || ${JSON.stringify(pass.info)}::jsonb` }
        : {}),
    })
    .where(eq(workerBeats.name, WORKER_NAME))
}

/** The worker's pulse row, or nothing when no worker has ever started against this database. */
export async function workerBeat(db: DbOrTx): Promise<WorkerBeat | undefined> {
  const [row] = await db.select().from(workerBeats).where(eq(workerBeats.name, WORKER_NAME))
  return row
}

export interface StatusFacts {
  now: Date
  beat: WorkerBeat | undefined
  /** A worker process holds the leader lock right now. Postgres drops it the moment the process dies. */
  lockHeld: boolean
  hourly: {
    /** The newest hourly check of any desk, and what started it. */
    latest: { scheduledFor: Date; trigger: string } | undefined
    lastCronAt: Date | undefined
    /** Hourly checks in the last 24 hours, by what started them. */
    byTrigger: Record<string, number>
    runningDesks: number
  }
  serv: {
    last:
      | { at: Date; ok: boolean; error: string | null; latencyMs: number; model: string; purpose: string }
      | undefined
    ok24h: number
    failed24h: number
  }
  prices: {
    at: Date | undefined
    tokens: number
    withFeed: number
    oldestFeedAt: Date | undefined
    newestFeedAt: Date | undefined
    halted: string[]
    haltUnknown: string[]
    oraclePaused: string[]
  }
  telegram: { waiting: number; failed24h: number; lastSentAt: Date | undefined }
  chat: {
    waiting: number
    failed24h: number
    last: { askedAt: Date; answeredAt: Date } | undefined
  }
  counts: { desks: number; checks: number; records: number; onChain: number }
}

const date = (v: unknown): Date | undefined => (v ? new Date(v as string) : undefined)
const num = (v: unknown): number => Number(v ?? 0)

export async function statusFacts(db: DbOrTx): Promise<StatusFacts> {
  const one = async <T extends Record<string, unknown>>(q: ReturnType<typeof sql>) =>
    (await db.execute<T>(q)).rows[0]

  const [beat, lock, latest, triggers, serv, servCounts, prices, telegram, chat, lastAnswer, counts, now] =
    await Promise.all([
      db
        .select()
        .from(workerBeats)
        .where(eq(workerBeats.name, WORKER_NAME))
        .then((r) => r[0]),
      one<{ held: boolean }>(sql`
      select exists(
        select 1 from pg_locks
        where locktype = 'advisory' and classid = 0 and objid = ${LEADER_LOCK_KEY} and objsubid = 1 and granted
      ) as held`),
      one<{ scheduled_for: string; trigger: string }>(sql`
      select scheduled_for, trigger from wakes
      where trigger in ('cron', 'tick')
      order by scheduled_for desc, started_at asc
      limit 1`),
      db.execute<{ trigger: string; n: string; last: string | null }>(sql`
      select trigger, count(*) as n, max(started_at) as last from wakes
      where trigger in ('cron', 'tick') and scheduled_for > now() - interval '24 hours'
      group by trigger`),
      one<{
        at: string
        ok: boolean
        error: string | null
        latency_ms: number
        model: string
        purpose: string
      }>(sql`
      select at, ok, error, latency_ms, model, purpose from serv_calls order by at desc limit 1`),
      one<{ ok: string; failed: string }>(sql`
      select count(*) filter (where ok) as ok, count(*) filter (where not ok) as failed
      from serv_calls where at > now() - interval '24 hours'`),
      db.execute<{
        at: string
        token: string
        feed: boolean
        feed_updated_at: string | null
        halted: boolean | null
        oracle_paused: boolean | null
      }>(sql`
      select at, token, feed_price_e8 is not null as feed, feed_updated_at, halted, oracle_paused
      from price_points
      where at = (select max(at) from price_points)`),
      one<{ waiting: string; failed: string; last_sent: string | null }>(sql`
      select
        count(*) filter (where status = 'pending' and send_after < now() - interval '2 minutes') as waiting,
        count(*) filter (where status = 'failed' and created_at > now() - interval '24 hours') as failed,
        max(sent_at) as last_sent
      from notifications`),
      one<{ waiting: string; failed: string }>(sql`
      select
        count(*) filter (where status in ('pending', 'claimed') and created_at < now() - interval '1 minute') as waiting,
        count(*) filter (where status = 'failed' and created_at > now() - interval '24 hours') as failed
      from ask_requests`),
      one<{ created_at: string; answered_at: string }>(sql`
      select created_at, answered_at from ask_requests
      where answered_at is not null order by answered_at desc limit 1`),
      one<{ desks: string; checks: string; records: string; on_chain: string }>(sql`
      select
        (select count(*) from desks where lifecycle = 'running') as desks,
        (select count(*) from wakes where status = 'completed') as checks,
        (select count(*) from decisions) as records,
        (select count(*) from actions where status = 'confirmed') as on_chain`),
      one<{ now: string }>(sql`select now() as now`),
    ])

  const byTrigger: Record<string, number> = {}
  let lastCronAt: Date | undefined
  for (const row of triggers.rows) {
    byTrigger[row.trigger] = num(row.n)
    if (row.trigger === 'cron') lastCronAt = date(row.last)
  }
  const cronEver = lastCronAt
    ? undefined
    : await one<{ last: string | null }>(
        sql`select max(started_at) as last from wakes where trigger = 'cron'`,
      )

  const slot = prices.rows
  const feedTimes = slot.flatMap((r) => (r.feed_updated_at ? [new Date(r.feed_updated_at).getTime()] : []))
  return {
    now: new Date(now?.now ?? Date.now()),
    beat,
    lockHeld: Boolean(lock?.held),
    hourly: {
      latest: latest ? { scheduledFor: new Date(latest.scheduled_for), trigger: latest.trigger } : undefined,
      lastCronAt: lastCronAt ?? date(cronEver?.last),
      byTrigger,
      runningDesks: num(counts?.desks),
    },
    serv: {
      last: serv
        ? {
            at: new Date(serv.at),
            ok: serv.ok,
            error: serv.error,
            latencyMs: serv.latency_ms,
            model: serv.model,
            purpose: serv.purpose,
          }
        : undefined,
      ok24h: num(servCounts?.ok),
      failed24h: num(servCounts?.failed),
    },
    prices: {
      at: date(slot[0]?.at),
      tokens: slot.length,
      withFeed: slot.filter((r) => r.feed).length,
      oldestFeedAt: feedTimes.length ? new Date(Math.min(...feedTimes)) : undefined,
      newestFeedAt: feedTimes.length ? new Date(Math.max(...feedTimes)) : undefined,
      halted: slot.filter((r) => r.halted === true).map((r) => r.token),
      haltUnknown: slot.filter((r) => r.halted === null).map((r) => r.token),
      oraclePaused: slot.filter((r) => r.oracle_paused === true).map((r) => r.token),
    },
    telegram: {
      waiting: num(telegram?.waiting),
      failed24h: num(telegram?.failed),
      lastSentAt: date(telegram?.last_sent),
    },
    chat: {
      waiting: num(chat?.waiting),
      failed24h: num(chat?.failed),
      last: lastAnswer
        ? { askedAt: new Date(lastAnswer.created_at), answeredAt: new Date(lastAnswer.answered_at) }
        : undefined,
    },
    counts: {
      desks: num(counts?.desks),
      checks: num(counts?.checks),
      records: num(counts?.records),
      onChain: num(counts?.on_chain),
    },
  }
}

export interface DeskCheck {
  id: string
  name: string | null
  address: string
  shareSlug: string | null
  shareEnabled: boolean
  mode: 'shadow' | 'ask_first' | 'on_its_own'
  state: 'active' | 'paused_by_owner' | 'stopped_by_loss_limit' | 'needs_attention'
  lifecycle: 'onboarding' | 'running' | 'closing' | 'closed'
  startedAt: Date | null
  mine: boolean
  lastCheck: { at: Date; status: string; trigger: string } | undefined
}

/**
 * Each desk Status may show, with its last check of any kind: every running desk with sharing on, and the
 * signed-in owner's own desks whether shared or not. Nobody else's private desk appears.
 */
export async function statusDesks(db: DbOrTx, ownerAddress: string | undefined): Promise<DeskCheck[]> {
  const owner = ownerAddress?.toLowerCase() ?? ''
  const rows = await db.execute<{
    id: string
    name: string | null
    address: string
    share_slug: string | null
    share_enabled: boolean
    mode: DeskCheck['mode']
    state: DeskCheck['state']
    lifecycle: DeskCheck['lifecycle']
    started_at: string | null
    mine: boolean
    last_at: string | null
    last_status: string | null
    last_trigger: string | null
  }>(sql`
    select d.id, d.name, d.address, d.share_slug, d.share_enabled, d.mode, d.state, d.lifecycle, d.started_at,
      o.address = ${owner} as mine,
      w.started_at as last_at, w.status as last_status, w.trigger as last_trigger
    from desks d
    join owners o on o.id = d.owner_id
    left join lateral (
      select started_at, status, trigger from wakes where desk_id = d.id order by started_at desc limit 1
    ) w on true
    where d.lifecycle = 'running' and (d.share_enabled or o.address = ${owner})
    order by (o.address = ${owner}) desc, d.started_at asc nulls last`)
  return rows.rows.map((r) => ({
    id: r.id,
    name: r.name,
    address: r.address,
    shareSlug: r.share_slug,
    shareEnabled: r.share_enabled,
    mode: r.mode,
    state: r.state,
    lifecycle: r.lifecycle,
    startedAt: date(r.started_at) ?? null,
    mine: r.mine,
    lastCheck: r.last_at
      ? { at: new Date(r.last_at), status: r.last_status ?? '', trigger: r.last_trigger ?? '' }
      : undefined,
  }))
}

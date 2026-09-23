/**
 * The public proof page's numbers (PLAN-ROUND-3 D9, D10), straight from the record: agents, followers, confirmed
 * trades and the USDG they moved, fingerprint checkpoints, SERV Reasoning calls, OpenServ runs, copy fees, and the
 * latest confirmed transactions. Nothing here names an owner.
 */
import { sql } from 'drizzle-orm'
import type { DbOrTx } from '../client'

const first = async <T>(db: DbOrTx, query: ReturnType<typeof sql>): Promise<T> => {
  const r = await db.execute(query)
  return r.rows[0] as T
}

export async function liveCounts(db: DbOrTx) {
  const [agents, followers, trades, checkpoints, serv, runs, fees] = await Promise.all([
    first<{ all: string; trading: string }>(
      db,
      sql`
      select count(*) filter (where lifecycle <> 'closed') as all,
             count(*) filter (where lifecycle = 'running' and mode <> 'shadow') as trading
      from desks where deployed_at is not null`,
    ),
    first<{ n: string }>(db, sql`select count(*) as n from copy_links where status <> 'stopped'`),
    first<{ n: string; moved: string | null }>(
      db,
      sql`
      select count(*) as n,
             coalesce(sum(case when kind = 'buy' then amount_in when kind = 'sell' then actual_out else 0 end), 0)::text as moved
      from actions where status = 'confirmed' and kind in ('buy', 'sell')`,
    ),
    first<{ n: string }>(
      db,
      sql`select count(*) as n from actions where status = 'confirmed' and kind = 'checkpoint'`,
    ),
    first<{ n: string }>(db, sql`select count(*) as n from serv_calls where ok = true`),
    first<{ n: string }>(db, sql`select count(*) as n from wakes where trigger = 'cron'`),
    first<{ copies: string; total: string | null }>(
      db,
      sql`
      select count(*) as copies, coalesce(sum(fee_usdg), 0)::text as total
      from copy_links where creator_fee_tx is not null`,
    ),
  ])
  return {
    agents: Number(agents.all),
    trading: Number(agents.trading),
    followers: Number(followers.n),
    trades: Number(trades.n),
    movedRaw: BigInt(trades.moved ?? '0'),
    checkpoints: Number(checkpoints.n),
    servCalls: Number(serv.n),
    openservRuns: Number(runs.n),
    paidCopies: Number(fees.copies),
    feesRaw: BigInt(fees.total ?? '0'),
  }
}

/** The latest confirmed transactions, newest first, with the agent's name and its public link when it is shared. */
export async function latestConfirmedActions(db: DbOrTx, limit = 10) {
  const r = await db.execute<{
    kind: string
    tx_hash: string
    token: string | null
    name: string | null
    share_slug: string | null
    share_enabled: boolean
    at: Date | string
  }>(sql`
    select a.kind, a.tx_hash, a.token, d.name, d.share_slug, d.share_enabled,
           coalesce(a.resolved_at, a.sent_at, a.planned_at) as at
    from actions a join desks d on d.id = a.desk_id
    where a.status = 'confirmed' and a.tx_hash is not null
    order by coalesce(a.resolved_at, a.sent_at, a.planned_at) desc
    limit ${limit}`)
  return r.rows.map((row) => ({
    kind: row.kind,
    txHash: row.tx_hash,
    token: row.token,
    deskName: row.name ?? 'Agent',
    deskSlug: row.share_enabled ? row.share_slug : null,
    at: new Date(row.at).toISOString(),
  }))
}

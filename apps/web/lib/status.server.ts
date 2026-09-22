/**
 * Builds the Status page from readings taken now: the worker's lock and heartbeat, the wakes, the SERV log, the
 * price log, the outbox, the chat queue, and one live read of the chain. Each row is graded by a plain threshold
 * written next to it, and says in words what was read.
 */
import { APPROVED_TOKENS } from '@desk/chain'
import { type DeskCheck, type StatusFacts, statusDesks, statusFacts } from '@desk/db'
import { ago, deskCopy, errorText, marketClock, newYorkTime, statusCopy, webCopy } from '@desk/shared'
import { createPublicClient, http } from 'viem'
import { robinhood } from 'viem/chains'
import type { StatusDesk, StatusPayload, StatusRow, Tone } from '@/features/status/protocol'
import { rpcUrl } from './chain'
import { db } from './db'

const d = statusCopy.detail
const MIN = 60_000
const HOUR = 60 * MIN

/** A pass slower than this is worth a word; this much longer and the loop is stuck. A check can take minutes. */
const WORKER_SLOW_MS = 3 * MIN
const WORKER_STUCK_MS = 15 * MIN
/** The price logger writes every five minutes. Two missed slots warn, six are a failure. */
const PRICES_WARN_MS = 10 * MIN
const PRICES_BAD_MS = 30 * MIN
/** A new block is made every quarter second or so; a head this old means the node is behind. */
const BLOCK_WARN_S = 60
const BLOCK_BAD_S = 600
/** An hourly check is due at the top of the hour and taken by the timer 7 minutes in. Past this, it was missed. */
const HOURLY_LATE_MS = 90 * MIN
/** "Has not checked in" [8.16]: a running desk whose last check is older than this. */
const DESK_LATE_MS = 2 * HOUR

const symbolOf = new Map(APPROVED_TOKENS.map((t) => [t.address.toLowerCase(), t.symbol]))
const symbols = (tokens: string[]) => tokens.map((t) => symbolOf.get(t.toLowerCase()) ?? t).join(', ')
const secs = (ms: number) => Math.max(0, Math.round(ms / 1000))
const lagOf = (at: Date, now: Date) => statusCopy.lag(secs(now.getTime() - at.getTime()))
const join = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' · ')

export async function loadStatus(viewer: string | undefined): Promise<StatusPayload> {
  const [facts, desks, chain] = await Promise.all([statusFacts(db()), statusDesks(db(), viewer), readChain()])
  const now = facts.now
  const rows = [
    workerRow(facts),
    openservRow(facts),
    servRow(facts),
    rpcRow(chain),
    pricesRow(facts),
    feedsRow(facts),
    haltsRow(facts),
    telegramRow(facts),
    chatRow(facts),
  ]
  const counted = rows.filter((r) => r.tone === 'bad' || r.tone === 'warn')
  const bad = counted.find((r) => r.tone === 'bad') ?? counted[0]
  return {
    checkedAtMs: now.getTime(),
    healthy: counted.length === 0,
    worst: bad ? bad.label : null,
    block: chain.ok ? chain.block.toLocaleString('en-US') : null,
    rows,
    desks: desks.map((desk) => deskRow(desk, now)),
    counts: (['desks', 'checks', 'records', 'onChain'] as const).map((key) => ({
      label: statusCopy.counts[key][0],
      note: statusCopy.counts[key][1],
      value: facts.counts[key].toLocaleString('en-US'),
    })),
  }
}

type Chain = { ok: true; block: bigint; madeAt: Date; ms: number } | { ok: false; why: string; ms: number }

/** One read, no retries: a retry would hide exactly the slowness this row exists to show. */
async function readChain(): Promise<Chain> {
  const client = createPublicClient({
    chain: robinhood,
    transport: http(rpcUrl(), { retryCount: 0, timeout: 8_000 }),
  })
  const started = Date.now()
  try {
    const block = await client.getBlock({ blockTag: 'latest' })
    return {
      ok: true,
      block: block.number,
      madeAt: new Date(Number(block.timestamp) * 1000),
      ms: Date.now() - started,
    }
  } catch (e) {
    return {
      ok: false,
      why: errorText(e).split('\n')[0]?.slice(0, 120) ?? 'no answer',
      ms: Date.now() - started,
    }
  }
}

function row(
  id: keyof typeof statusCopy.rows,
  tone: Tone,
  detail: string,
  lag: string | null = null,
  chip: string | null = null,
): StatusRow {
  return { id, label: statusCopy.rows[id], tone, detail, lag, chip }
}

function workerRow(f: StatusFacts): StatusRow {
  const beat = f.beat
  if (!beat) return row('worker', 'bad', d.workerNever)
  const sinceMs = f.now.getTime() - beat.beatAt.getTime()
  const lag = lagOf(beat.beatAt, f.now)
  const info = beat.info as { tickMs?: number; commit?: string | null; rehearsal?: boolean }
  if (!f.lockHeld) return row('worker', 'bad', d.workerDown(ago(beat.beatAt, f.now)), lag)
  const tone: Tone =
    sinceMs > WORKER_STUCK_MS ? 'bad' : sinceMs > WORKER_SLOW_MS ? 'warn' : beat.lastError ? 'warn' : 'good'
  const detail =
    sinceMs > WORKER_SLOW_MS
      ? d.workerSlow(ago(beat.beatAt, f.now))
      : d.workerOk(
          `${Math.round((info.tickMs ?? 15_000) / 1000)} s`,
          ago(beat.beatAt, f.now),
          ago(beat.startedAt, f.now).replace(/ ago$/, ''),
        )
  return row(
    'worker',
    tone,
    join(
      detail,
      beat.lastError && d.lastError(beat.lastError),
      info.commit && d.commit(info.commit),
      info.rehearsal && d.rehearsal,
    ),
    lag,
  )
}

function openservRow(f: StatusFacts): StatusRow {
  const h = f.hourly
  const agent = (f.beat?.info as { openservAgent?: number | null } | undefined)?.openservAgent ?? null
  if (h.runningDesks === 0) return row('openserv', 'off', d.noDesks)
  if (!h.latest) return row('openserv', 'warn', agent === null ? d.notRegistered : d.noHourly('the start'))
  const hour = newYorkTime(h.latest.scheduledFor)
  const lag = lagOf(h.latest.scheduledFor, f.now)
  if (f.now.getTime() - h.latest.scheduledFor.getTime() > HOURLY_LATE_MS)
    return row('openserv', 'bad', d.noHourly(hour), lag)
  const total = Object.values(h.byTrigger).reduce((a, b) => a + b, 0)
  if (h.latest.trigger === 'cron') {
    return row(
      'openserv',
      'good',
      join(d.hourCron(hour, h.byTrigger.cron ?? 0, total), agent !== null && d.agent(agent)),
      lag,
    )
  }
  if (agent === null) return row('openserv', 'warn', d.notRegistered, lag)
  return row(
    'openserv',
    'warn',
    h.lastCronAt ? d.hourTick(hour, ago(h.lastCronAt, f.now)) : d.hourTickNever(hour),
    lag,
  )
}

function servRow(f: StatusFacts): StatusRow {
  const last = f.serv.last
  if (!last) return row('serv', 'warn', d.servNone)
  const day = d.servDay(f.serv.ok24h, f.serv.failed24h)
  if (!last.ok) {
    const why = (last.error ?? 'no reason given').split('\n')[0]?.slice(0, 140) ?? ''
    return row(
      'serv',
      'bad',
      join(d.servFailed(ago(last.at, f.now), why), day),
      statusCopy.latency(last.latencyMs),
    )
  }
  return row(
    'serv',
    'good',
    join(d.servOk(ago(last.at, f.now), last.model), day),
    statusCopy.latency(last.latencyMs),
  )
}

function rpcRow(c: Chain): StatusRow {
  if (!c.ok) return row('rpc', 'bad', d.rpcDown(c.why), statusCopy.latency(c.ms))
  const ageS = secs(Date.now() - c.madeAt.getTime())
  const tone: Tone = ageS > BLOCK_BAD_S ? 'bad' : ageS > BLOCK_WARN_S ? 'warn' : 'good'
  return row('rpc', tone, d.rpcOk(c.block.toLocaleString('en-US'), ago(c.madeAt)), statusCopy.latency(c.ms))
}

function pricesRow(f: StatusFacts): StatusRow {
  const p = f.prices
  if (!p.at) return row('prices', 'bad', d.pricesNone)
  const ms = f.now.getTime() - p.at.getTime()
  const tone: Tone = ms > PRICES_BAD_MS ? 'bad' : ms > PRICES_WARN_MS ? 'warn' : 'good'
  return row('prices', tone, d.pricesOk(p.tokens, ago(p.at, f.now)), lagOf(p.at, f.now))
}

/** Outside regular hours the feeds barely move by design, so their age is expected and never degrades. */
function feedsRow(f: StatusFacts): StatusRow {
  const p = f.prices
  if (!p.at || p.tokens === 0) return row('feeds', 'bad', d.feedsNone)
  const missing = p.tokens - p.withFeed
  const newest = p.newestFeedAt ? ago(p.newestFeedAt, f.now) : '—'
  const tone: Tone = missing > 0 ? 'bad' : p.oraclePaused.length > 0 ? 'warn' : 'good'
  const detail = join(
    d.feedsOk(p.withFeed, p.tokens, newest),
    missing > 0 && d.feedsMissing(missing),
    p.oraclePaused.length > 0 && d.oraclePaused(symbols(p.oraclePaused)),
  )
  const session = marketClock(f.now).session
  const shut = session !== 'regular'
  return row(
    'feeds',
    shut && tone === 'good' ? 'off' : tone,
    detail,
    p.newestFeedAt && !shut ? lagOf(p.newestFeedAt, f.now) : null,
    shut && tone === 'good' ? statusCopy.expected(webCopy.session.words[session]) : null,
  )
}

function haltsRow(f: StatusFacts): StatusRow {
  const p = f.prices
  if (!p.at) return row('halts', 'bad', d.feedsNone)
  const tone: Tone = p.halted.length > 0 || p.haltUnknown.length > 0 ? 'warn' : 'good'
  const detail = join(
    p.halted.length > 0 && d.halted(symbols(p.halted)),
    p.haltUnknown.length > 0 && d.haltUnknown(symbols(p.haltUnknown)),
  )
  return row('halts', tone, detail || d.haltsNone, lagOf(p.at, f.now))
}

function telegramRow(f: StatusFacts): StatusRow {
  const t = f.telegram
  const on = (f.beat?.info as { telegram?: boolean } | undefined)?.telegram
  if (on === false) return row('telegram', 'off', d.telegramOff, null, statusCopy.optional)
  const tone: Tone = t.waiting > 0 || t.failed24h > 0 ? 'warn' : 'good'
  return row(
    'telegram',
    tone,
    join(
      t.lastSentAt ? d.telegramOk(ago(t.lastSentAt, f.now)) : d.telegramNone,
      t.waiting > 0 && d.telegramWaiting(t.waiting),
      t.failed24h > 0 && d.telegramFailed(t.failed24h),
    ),
    t.lastSentAt ? lagOf(t.lastSentAt, f.now) : null,
  )
}

function chatRow(f: StatusFacts): StatusRow {
  const c = f.chat
  const tone: Tone = c.waiting > 0 ? 'bad' : c.failed24h > 0 ? 'warn' : 'good'
  const took = c.last ? statusCopy.latency(c.last.answeredAt.getTime() - c.last.askedAt.getTime()) : null
  return row(
    'chat',
    tone,
    join(
      c.last && took ? d.chatOk(took, ago(c.last.answeredAt, f.now)) : d.chatNone,
      c.waiting > 0 && d.chatWaiting(c.waiting),
      c.failed24h > 0 && d.chatFailed(c.failed24h),
    ),
    took,
  )
}

/** One desk's line: its last check, or the brief's "has not checked in" [8.16] when that is too long ago. */
function deskRow(desk: DeskCheck, now: Date): StatusDesk {
  const s = statusCopy.desks
  const base = {
    id: desk.id,
    name: desk.name ?? s.unnamed,
    href:
      desk.shareEnabled && desk.shareSlug
        ? `/desk/${desk.shareSlug}`
        : desk.mine
          ? `/desk/${desk.shareSlug ?? desk.id}`
          : null,
    chip: null,
  }
  const who = join(deskCopy.modes[desk.mode], desk.mine && s.yours)
  if (desk.state === 'paused_by_owner')
    return { ...base, tone: 'off', lag: null, detail: join(who, s.paused) }
  if (desk.state === 'stopped_by_loss_limit')
    return { ...base, tone: 'warn', lag: null, detail: join(who, s.stopped) }
  const last = desk.lastCheck
  if (!last) {
    const due = new Date(Math.ceil(now.getTime() / HOUR) * HOUR)
    return { ...base, tone: 'off', lag: null, detail: join(who, s.never(newYorkTime(due))) }
  }
  const lag = lagOf(last.at, now)
  if (now.getTime() - last.at.getTime() > DESK_LATE_MS)
    return { ...base, tone: 'bad', lag, detail: join(who, s.late(ago(last.at, now))) }
  const detail = join(who, s.lastCheck(ago(last.at, now), s.status[last.status] ?? last.status))
  if (desk.state === 'needs_attention')
    return { ...base, tone: 'warn', lag, detail: join(detail, s.attention) }
  return { ...base, tone: last.status === 'failed' ? 'warn' : 'good', lag, detail }
}

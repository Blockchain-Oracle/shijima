/**
 * The chat's loop. The web writes a message row and sends NOTIFY; this answers it.
 *
 * Two ways in, so a message is never missed: LISTEN on one held connection for the instant path, and a sweep
 * every second behind it for a NOTIFY lost to a dropped connection. Both call the same claim, which uses SKIP
 * LOCKED, so a message is answered exactly once however they race.
 *
 * It runs beside the desk's clock, never inside it. A check can take a minute; a person typing should not wait
 * for it. Nothing here trades: an answer is words and, at most, a saved proposal the owner must confirm.
 */
import { APPROVED_TOKENS } from '@desk/chain'
import { answerAskRequest } from '@desk/core'
import {
  ASK_CHANNEL,
  type AskRequestRow,
  claimAskRequests,
  expireProposals,
  sweepStuckAskRequests,
} from '@desk/db'
import { errorText } from '@desk/shared'
import type { PoolClient } from 'pg'
import type { Cli, Log } from './review'

const SWEEP_MS = 1_000
const EXPIRE_EVERY_MS = 60_000
/** SERV takes 6 to 10 seconds. A few at once keeps one slow answer from queueing everyone else. */
const MAX_AT_ONCE = 3
/** A claimed message older than this was being answered by a worker that stopped. */
const STUCK_MS = 2 * 60 * 1000

export interface AskLoop {
  /** Answers anything waiting now. Telegram calls this right after it writes a message. */
  kick: () => void
  /** Called once each message is answered. Telegram delivers its replies from here, so the bot never waits. */
  onAnswered: (handler: (row: AskRequestRow) => Promise<void>) => void
  stop: () => Promise<void>
}

export async function startAskLoop(cli: Cli, log: Log): Promise<AskLoop> {
  const deps = { db: cli.db, pub: cli.pub, approved: APPROVED_TOKENS, servApiKey: cli.env.SERV_API_KEY, log }
  const inFlight = new Set<Promise<void>>()
  let stopping = false
  let claiming = false
  let listener: PoolClient | undefined
  const answered: ((row: AskRequestRow) => Promise<void>)[] = []

  /** A claim whose answer hangs must not hold one of the three slots for ever. Swept on boot and then every minute. */
  const sweepStuck = async () => {
    const stuck = await sweepStuckAskRequests(cli.db, new Date(Date.now() - STUCK_MS))
    if (stuck > 0) log('ask_stuck', { failed: stuck, note: 'claimed but never answered' })
  }
  await sweepStuck()

  const kick = () => {
    if (stopping || claiming || inFlight.size >= MAX_AT_ONCE) return
    claiming = true
    claimAskRequests(cli.db, MAX_AT_ONCE - inFlight.size)
      .then((rows) => {
        for (const row of rows) {
          const started = Date.now()
          const job = answerAskRequest(deps, row)
            .then(() => log('ask_answered', { request: row.id, via: row.via, ms: Date.now() - started }))
            .then(() => Promise.allSettled(answered.map((h) => h(row))))
            .then(() => undefined)
            .finally(() => {
              inFlight.delete(job)
              kick()
            })
          inFlight.add(job)
        }
      })
      .catch((e) => log('ask_claim_failed', { error: errorText(e) }))
      .finally(() => {
        claiming = false
      })
  }

  const listen = async () => {
    try {
      const client = await cli.pool.connect()
      client.on('notification', () => kick())
      client.on('error', (e) => {
        log('ask_listen_dropped', { error: errorText(e), note: 'the sweep covers it until it is back' })
        client.release(true)
        listener = undefined
        if (!stopping) setTimeout(() => void listen(), 5_000)
      })
      await client.query(`LISTEN ${ASK_CHANNEL}`)
      listener = client
    } catch (e) {
      log('ask_listen_failed', { error: errorText(e) })
      if (!stopping) setTimeout(() => void listen(), 5_000)
    }
  }
  await listen()

  const sweep = setInterval(kick, SWEEP_MS)
  const expire = setInterval(() => {
    expireProposals(cli.db).catch((e) => log('ask_expire_failed', { error: errorText(e) }))
    sweepStuck().catch((e) => log('ask_sweep_failed', { error: errorText(e) }))
  }, EXPIRE_EVERY_MS)
  kick()
  log('ask_listening', { channel: ASK_CHANNEL })

  return {
    kick,
    onAnswered: (handler) => {
      answered.push(handler)
    },
    stop: async () => {
      stopping = true
      clearInterval(sweep)
      clearInterval(expire)
      await Promise.allSettled([...inFlight])
      if (listener) {
        await listener.query(`UNLISTEN ${ASK_CHANNEL}`).catch(() => undefined)
        listener.release()
      }
    },
  }
}

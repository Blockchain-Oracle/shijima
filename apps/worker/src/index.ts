/**
 * The worker: the desk's clock. One process. LOCAL FIRST: run it with `pnpm worker:start`.
 *
 *   boot      become the leader, then settle every transaction an earlier run left unfinished
 *   each tick  do the work in review.ts, which is the same work OpenServ's cron asks for
 *   the chat   answered as it arrives, in ask.ts, beside the clock
 *
 * This timer is the SAFETY NET, not the clock. OpenServ's hourly cron is the primary trigger. A check is keyed
 * on (desk, the top of the hour), so whichever arrives first does the work and the other finds it already done.
 */
import { execFileSync } from 'node:child_process'
import { recordWorkerPass, startWorkerBeat, sweepInterruptedWakes } from '@desk/db'
import { errorText } from '@desk/shared'
import { startAskLoop } from './ask'
import { openCli } from './cli/context'
import { tryBecomeLeader } from './leader'
import { startAgentIfProvisioned } from './openserv/serve'
import { reviewAllDesks } from './review'
import { resolveUnsettled } from './sender'
import { startTelegram } from './telegram/start'

const TICK_MS = 15_000
/** A check still running after this long was interrupted by a crash. Its hour is freed, and the record says so. */
const STUCK_WAKE_MS = 15 * 60 * 1000
const log = (event: string, detail: Record<string, unknown> = {}) =>
  console.log(JSON.stringify({ at: new Date().toISOString(), event, ...detail }))

const cli = await openCli()
const leader = await tryBecomeLeader(cli.pool)
if (!leader) {
  log('not_leader', { note: 'another worker holds the lock, so this one exits' })
  await cli.close()
  process.exit(0)
}

let stopping = false
let running: Promise<unknown> = Promise.resolve()
const loop = async () => {
  while (!stopping) {
    const started = Date.now()
    running = reviewAllDesks(cli, log)
      // The outbox is drained after the work, so a message never announces something not yet committed.
      .then(() => telegram?.drain())
      .then(() => undefined)
      .catch((e) => {
        log('tick_failed', { error: errorText(e) })
        return errorText(e)
      })
      // The pulse Status reads. A failed write here must never stop the clock.
      .then((error) =>
        recordWorkerPass(cli.db, { ms: Date.now() - started, ...(error ? { error } : {}) }).catch(
          () => undefined,
        ),
      )
    await running
    await new Promise((r) => setTimeout(r, TICK_MS))
  }
}
const stop = async (signal: string) => {
  if (stopping) return
  stopping = true
  log('stopping', { signal, note: 'finishing the check in progress first' })
  await running
  await ask.stop()
  await agent?.stop()
  await telegram?.stop()
  await leader.release()
  await cli.close()
  process.exit(0)
}
process.on('SIGINT', () => void stop('SIGINT'))
process.on('SIGTERM', () => void stop('SIGTERM'))

log('leader', { operator: cli.wallet.account.address, rehearsal: cli.env.isRehearsal })
const agent = await startAgentIfProvisioned(cli, log)
// The chat answers beside the clock, never inside it: a person typing should not wait for a check.
const ask = await startAskLoop(cli, log)
const telegram = startTelegram(cli, log, ask)
await startWorkerBeat(cli.db, {
  operator: cli.wallet.account.address,
  rehearsal: cli.env.isRehearsal,
  openservAgent: agent?.agentId ?? null,
  openservWorkflow: agent?.workflowId ?? null,
  telegram: Boolean(telegram),
  tickMs: TICK_MS,
  commit: gitCommit(),
})
for (const stuck of await sweepInterruptedWakes(cli.db, new Date(Date.now() - STUCK_WAKE_MS))) {
  log('interrupted_check', { desk: stuck.deskId, hour: stuck.scheduledFor.toISOString() })
}
await resolveUnsettled(cli.deps)
await loop()

/** The commit this process runs, so Status can say which code is awake. Unknown outside a checkout. */
function gitCommit(): string | null {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim()
  } catch {
    return null
  }
}

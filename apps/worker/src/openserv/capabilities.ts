/**
 * What another OpenServ agent (or the platform's own) may ask Shijima, from a workspace its owner linked.
 *
 *   agent_status       the linked desk: name, mode, state, last check          reads
 *   latest_decisions   its newest decisions, compact, with links               reads
 *   check_now          one check at once, only if the owner allowed it          wakes the engine
 *   propose_change     a change in words, answered as a card to confirm         changes nothing
 *
 * The workspace is the only credential. Every call finds the desk through the workspace's link and nothing else,
 * so a workspace that is not linked learns nothing about anyone's desk, and a linked one reaches only its own.
 *
 * check_now can never do more than the hourly check does: the engine, its gate and the contract's caps decide,
 * exactly as always. Nothing here withdraws, raises a limit, or signs.
 */
import {
  deskForWorkspace,
  lastCheckOf,
  type OpenservOrigin,
  recentDecisionsOfDesk,
  requestCheck,
} from '@desk/db'
import { openservCopy as C } from '@desk/shared'
import type { Cli, Log } from '../review'
import { compactDecision } from './sessions'
import { answerWorkspace } from './talk'

/** The workspace fields a capability call carries. `workspaceKey` is the lasting identity (see agent.ts). */
export interface CallerSession {
  workspaceKey: string
  taskId: string | null
  executionId: string | null
}

type Linked = NonNullable<Awaited<ReturnType<typeof deskForWorkspace>>>
type Refusal = { ok: false; reply: string }

const siteOf = (cli: Cli) => cli.env.SITE_URL ?? 'http://localhost:3007'
const deskPath = (cli: Cli, d: Linked) => `${siteOf(cli)}/desk/${d.shareSlug ?? d.deskId}`

async function linkedDesk(cli: Cli, session: CallerSession): Promise<{ ok: true; desk: Linked } | Refusal> {
  const desk = session.workspaceKey ? await deskForWorkspace(cli.db, session.workspaceKey) : undefined
  // The same words whether the workspace was never linked or was unlinked: nothing about any desk leaks.
  if (!desk) return { ok: false, reply: C.notLinked(siteOf(cli)) }
  return { ok: true, desk }
}

export async function agentStatus(cli: Cli, session: CallerSession): Promise<string> {
  const found = await linkedDesk(cli, session)
  if (!found.ok) return found.reply
  const d = found.desk
  const last = await lastCheckOf(cli.db, d.deskId)
  return JSON.stringify({
    desk: d.name ?? 'your agent',
    address: d.address,
    mode: d.mode === 'shadow' ? 'practice' : d.mode,
    state: d.lifecycle,
    lastCheck: last ? { at: last.at.toISOString(), status: last.status } : null,
    workspaceMayTriggerChecks: d.allowChecks,
    url: deskPath(cli, d),
  })
}

export async function latestDecisions(cli: Cli, session: CallerSession, limit = 5): Promise<string> {
  const found = await linkedDesk(cli, session)
  if (!found.ok) return found.reply
  const path = deskPath(cli, found.desk)
  const rows = await recentDecisionsOfDesk(cli.db, found.desk.deskId, limit)
  return JSON.stringify({ desk: found.desk.name, decisions: rows.map((d) => compactDecision(d, path)) })
}

/**
 * Queues one check for the linked desk. The worker's pass picks it up within seconds and runs it like any
 * "check now": the same engine, gate and on-chain caps. The session is stamped on whatever it decides.
 */
export async function checkNow(
  cli: Cli,
  log: Log,
  session: CallerSession,
): Promise<{ ok: boolean; reply: string; requestId?: string }> {
  const found = await linkedDesk(cli, session)
  if (!found.ok) return found
  const d = found.desk
  if (!d.allowChecks) return { ok: false, reply: C.checksOff(`${deskPath(cli, d)}/settings`) }
  const origin: OpenservOrigin = {
    workspace: session.workspaceKey,
    taskId: session.taskId,
    executionId: session.executionId,
  }
  const asked = await requestCheck(cli.db, {
    deskId: d.deskId,
    requestedBy: d.ownerAddress,
    via: 'openserv',
    openserv: origin,
  })
  log('openserv_check_now', { desk: d.address, ok: asked.ok, ...(asked.ok ? {} : { reason: asked.reason }) })
  if (!asked.ok) return { ok: false, reply: C.checkRefused[asked.reason] }
  return { ok: true, reply: C.checkQueued(deskPath(cli, d)), requestId: asked.id }
}

/** A change in plain words. The desk's own brain answers, and anything that would change it is a card to confirm. */
export async function proposeChange(
  cli: Cli,
  log: Log,
  session: CallerSession,
  change: string,
): Promise<string> {
  const found = await linkedDesk(cli, session)
  if (!found.ok) return found.reply
  // Only the change itself: a "link <code>" line has no business in a proposal.
  const words = change
    .split('\n')
    .filter((l) => !/^\s*link\s+/i.test(l))
    .join('\n')
    .trim()
  if (!words) return C.failed
  return answerWorkspace(cli, log, session.workspaceKey, words)
}

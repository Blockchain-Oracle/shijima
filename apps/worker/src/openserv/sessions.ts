/**
 * What OpenServ gets to see of a decision, after the engine has made it.
 *
 *   markOrigin     the workspace, task and run that asked are stamped on the decisions its check wrote
 *   pushWebhooks   each linked workspace with a webhook-trigger URL receives a compact summary by POST
 *
 * Both run AFTER the decision exists and is sent. Neither can change it, and neither can hold the engine up:
 * the push is not awaited by the pass, has a short timeout, and every failure is only logged.
 */
import { APPROVED_TOKENS } from '@desk/chain'
import {
  deskById,
  markDecisionsFromOpenserv,
  type OpenservOrigin,
  openservWebhooksForDesk,
  recentDecisionsOfDesk,
} from '@desk/db'
import { errorText, registerSecrets, usd } from '@desk/shared'
import { openWebhookUrl } from '@desk/shared/webhook-box'
import type { Cli, Log } from '../review'

const PUSH_TIMEOUT_MS = 8_000

type Decision = Awaited<ReturnType<typeof recentDecisionsOfDesk>>[number]

const siteOf = (cli: Cli) => cli.env.SITE_URL ?? 'http://localhost:3007'
const symbolOf = (token: string | null) =>
  token
    ? (APPROVED_TOKENS.find((t) => t.address.toLowerCase() === token.toLowerCase())?.symbol ?? token)
    : null

/** The transaction hashes a decision's legs landed with, from its appended result. */
function txHashes(result: Decision['result']): string[] {
  if (!result) return []
  return Object.values(result).flatMap((leg) => {
    const hash = (leg as { txHash?: unknown } | null)?.txHash
    return typeof hash === 'string' ? [hash] : []
  })
}

/** One decision in the few words a workspace (or another agent) needs, with the link to the full record. */
export function compactDecision(d: Decision, deskPath: string) {
  return {
    seq: d.seq,
    outcome: d.outcome,
    summary: d.summary,
    token: symbolOf(d.token),
    side: d.side,
    amount: d.amountUsdg === null ? null : usd(d.amountUsdg),
    practice: d.shadow,
    txHashes: txHashes(d.result),
    decidedAt: d.decidedAt.toISOString(),
    askedBy: d.openservWorkspace ? { workspace: d.openservWorkspace, task: d.openservTaskId } : null,
    url: `${deskPath}/decision/${d.seq}`,
  }
}

/** Stamps the OpenServ session onto what a check wrote, then pushes those decisions to any linked webhook. */
export async function afterCheck(
  cli: Cli,
  log: Log,
  deskId: string,
  records: { seq: number | null }[],
  origin?: OpenservOrigin,
): Promise<void> {
  const seqs = records.flatMap((r) => (r.seq === null ? [] : [r.seq]))
  if (seqs.length === 0) return
  if (origin) {
    try {
      const n = await markDecisionsFromOpenserv(cli.db, deskId, seqs, origin)
      log('openserv_session_recorded', {
        desk: deskId,
        decisions: n,
        task: origin.taskId,
        execution: origin.executionId,
      })
    } catch (e) {
      log('openserv_session_failed', { desk: deskId, error: errorText(e) })
    }
  }
  // Not awaited: a slow or dead webhook must never delay the next desk.
  void pushWebhooks(cli, log, deskId, seqs).catch((e) =>
    log('openserv_webhook_failed', { desk: deskId, error: errorText(e) }),
  )
}

/** POSTs each new decision to every webhook linked to the desk. Returns how many deliveries succeeded. */
export async function pushWebhooks(cli: Cli, log: Log, deskId: string, seqs: number[]): Promise<number> {
  const hooks = await openservWebhooksForDesk(cli.db, deskId)
  if (hooks.length === 0) return 0
  const desk = await deskById(cli.db, deskId)
  if (!desk) return 0
  const deskPath = `${siteOf(cli)}/desk/${desk.shareSlug ?? desk.id}`
  const rows = await recentDecisionsOfDesk(cli.db, deskId, seqs.length, seqs)
  const body = JSON.stringify({
    source: 'shijima',
    event: 'decisions',
    desk: { name: desk.name, address: desk.address, url: deskPath },
    decisions: rows.map((d) => compactDecision(d, deskPath)),
  })
  let delivered = 0
  for (const hook of hooks) {
    try {
      const url = openWebhookUrl(hook.webhookUrlEnc ?? '')
      registerSecrets(url)
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
        signal: AbortSignal.timeout(PUSH_TIMEOUT_MS),
      })
      if (!res.ok) throw new Error(`the workspace answered ${res.status}`)
      delivered++
    } catch (e) {
      // The URL itself is never logged: its token starts someone's workflow.
      log('openserv_webhook_failed', { desk: deskId, link: hook.linkId, error: errorText(e) })
    }
  }
  if (delivered > 0) log('openserv_webhook_sent', { desk: deskId, decisions: rows.length, delivered })
  return delivered
}

/**
 *   RPC_URL=<fork> tsx src/cli/prove-openserv.ts     rehearsal only
 *
 * Proves, on a fork and a rehearsal database, what a linked OpenServ workspace can and cannot do:
 *   1. an unlinked workspace and a linked one without "allow checks" are refused, and learn nothing
 *   2. a linked workspace with "allow checks" calls check_now; the worker's pass runs it; the decision it writes
 *      carries the workspace, task and execution ids; the decision is POSTed to the workspace's webhook
 *   3. AgentKit's wallet provider signs the exact bytes the wallet client would
 *   4. no request went to AgentKit's telemetry host
 * It calls the capability handlers directly, the way the SDK's tool route does. Nothing reaches OpenServ.
 */
import { randomBytes, randomUUID } from 'node:crypto'
import { createServer } from 'node:http'
import { errorText } from '@desk/shared'
import { sealWebhookUrl } from '@desk/shared/webhook-box'
import { keccak256 } from 'viem'

import { agentKitSigner, createDeskAgentKit } from '../agentkit'
import { agentStatus, checkNow, latestDecisions } from '../openserv/capabilities'
import { reviewAllDesks } from '../review'
import { openCli } from './context'

const hosts = new Set<string>()
const realFetch = globalThis.fetch
globalThis.fetch = ((input: Parameters<typeof fetch>[0], init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  hosts.add(new URL(url).host)
  return realFetch(input, init)
}) as typeof fetch

const log = (event: string, detail: Record<string, unknown> = {}) =>
  console.log(`  · ${event} ${JSON.stringify(detail)}`)
const pass = (ok: boolean, what: string) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}`)
  if (!ok) process.exitCode = 1
}

const cli = await openCli()
if (!cli.env.isRehearsal) throw new Error('rehearsal only: set RPC_URL to a fork')
process.env.OPENSERV_WEBHOOK_KEY = randomBytes(32).toString('base64')

// A local stand-in for the workspace's webhook trigger.
const received: unknown[] = []
const server = createServer((req, res) => {
  let body = ''
  req.on('data', (c) => {
    body += c
  })
  req.on('end', () => {
    received.push(JSON.parse(body))
    res.writeHead(200).end('{}')
  })
})
await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
const port = (server.address() as { port: number }).port

try {
  const q = <T extends Record<string, unknown>>(text: string, values: unknown[] = []) =>
    cli.pool.query<T>(text, values).then((r) => r.rows)
  const [desk] = await q<{ id: string }>(
    `select id from desks where lifecycle = 'running' order by created_at desc limit 1`,
  )
  if (!desk) throw new Error('no running desk in the rehearsal database')
  const workspaceKey = `proof-bucket-${randomUUID().slice(0, 8)}`
  const [link] = await q<{ id: string }>(
    `insert into openserv_links (desk_id, status, code, code_expires_at, workspace_id, workspace_name, linked_at, webhook_url_enc)
     values ($1, 'linked', $2, now(), $3, 'Ask Shijima (proof)', now(), $4) returning id`,
    [
      desk.id,
      `P${randomBytes(4).toString('hex').toUpperCase()}`,
      workspaceKey,
      sealWebhookUrl(`http://127.0.0.1:${port}/webhooks/trigger/proof`),
    ],
  )
  if (!link) throw new Error('link not saved')
  const session = { workspaceKey, taskId: '777001', executionId: '888001' }

  console.log('\n1. refusals')
  const stranger = await checkNow(cli, log, { ...session, workspaceKey: 'not-linked-bucket' })
  pass(!stranger.ok && stranger.reply.includes('not linked'), 'an unlinked workspace is refused')
  const strangerStatus = await agentStatus(cli, { ...session, workspaceKey: 'not-linked-bucket' })
  pass(
    !strangerStatus.includes(desk.id) && !strangerStatus.startsWith('{'),
    'and learns nothing about any desk',
  )
  const noSwitch = await checkNow(cli, log, session)
  pass(
    !noSwitch.ok && noSwitch.reply.includes('not start checks'),
    'check_now without "allow checks" is refused',
  )

  console.log('\n2. check_now from a linked workspace that is allowed')
  await q('update openserv_links set allow_checks = true where id = $1', [link.id])
  // A fresh check must not be inside the ten-minute cooldown of an earlier one on this copied database.
  await q(`update check_requests set created_at = created_at - interval '1 day' where desk_id = $1`, [
    desk.id,
  ])
  const asked = await checkNow(cli, log, session)
  pass(asked.ok, `check_now queued: ${asked.reply}`)
  const summary = await reviewAllDesks(cli, log, { trigger: 'tick' })
  console.log(`  pass: ${JSON.stringify({ desks: summary.desks, held: summary.held })}`)
  const stamped = await q<{
    seq: number
    outcome: string
    summary: string
    openserv_task_id: string
    openserv_execution_id: string
  }>(
    `select seq, outcome, summary, openserv_task_id, openserv_execution_id from decisions
     where desk_id = $1 and openserv_workspace = $2 order by seq`,
    [desk.id, workspaceKey],
  )
  for (const d of stamped) console.log(`  decision #${d.seq} ${d.outcome}: ${d.summary.slice(0, 90)}`)
  pass(
    stamped.length > 0 &&
      stamped.every((d) => d.openserv_task_id === '777001' && d.openserv_execution_id === '888001'),
    `${stamped.length} decision(s) carry workspace ${workspaceKey}, task 777001, execution 888001`,
  )
  // The push is not awaited by the pass; give it a moment.
  await new Promise((r) => setTimeout(r, 1500))
  pass(received.length > 0, `the webhook received ${received.length} POST(s)`)
  if (received[0]) console.log(`  body: ${JSON.stringify(received[0]).slice(0, 400)}`)
  const latest = await latestDecisions(cli, session, 2)
  pass(latest.includes('"askedBy"'), 'latest_decisions answers the linked workspace')

  console.log('\n3. AgentKit signs the same bytes')
  const kit = await createDeskAgentKit(cli.deps, cli.env.rpcUrl)
  const request = await cli.wallet.prepareTransactionRequest({
    to: cli.wallet.account.address,
    data: '0x',
    nonce: 0,
  })
  const direct = await cli.wallet.signTransaction(request)
  const viaKit = await agentKitSigner(kit.walletProvider)({
    chainId: request.chainId ?? 4663,
    to: cli.wallet.account.address,
    data: '0x',
    nonce: 0,
    gas: request.gas,
    maxFeePerGas: request.maxFeePerGas,
    maxPriorityFeePerGas: request.maxPriorityFeePerGas,
  })
  pass(
    keccak256(direct) === keccak256(viaKit),
    `identical signed transaction ${keccak256(viaKit).slice(0, 18)}…`,
  )
  pass(
    kit.agentKit.getActions().length === 6,
    `AgentKit exposes ${kit.agentKit
      .getActions()
      .map((a) => a.name)
      .join(', ')}`,
  )

  await new Promise((r) => setTimeout(r, 500))
  console.log(`\n4. hosts contacted: ${[...hosts].join(', ') || 'none'}`)
  pass(![...hosts].some((h) => h.includes('coinbase')), 'no request to AgentKit telemetry')
} catch (e) {
  console.error(errorText(e))
  process.exitCode = 1
} finally {
  server.close()
  await cli.close()
}

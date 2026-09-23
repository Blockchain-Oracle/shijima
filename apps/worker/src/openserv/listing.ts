/**
 *   pnpm openserv:listing           fill the agent's public listing on OpenServ (logo, categories, usage text)
 *   pnpm openserv:listing --submit  the same, then ask OpenServ to review it for Browse agents
 *
 * The SDK's `agents.update` only carries name, description and endpoint, so this sends the whole record itself:
 * the API is a PUT that wants every field back. The logo goes to IPFS through OpenServ's own presigned link, the
 * same path its ERC-8004 cards take, because the agent needs a public image URL and we have no public host yet.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { errorText } from '@desk/shared'
import { PlatformClient } from '@openserv-labs/client'
import { WORKER_ROOT } from '../cli/context'
import { AGENT_NAME } from './agent'

const WORKFLOW_NAME = 'Hourly desk review'
// From the marketplace's own agents: 5 is "Finance and Technology", 3 is "Research and Analysis".
const CATEGORY_IDS = [5, 3]

const USAGE = [
  'Shijima runs from its own web app, not from a chat here: open the app, sign in with your wallet, and create a',
  'desk in one signature. The desk is a contract in your own account on Robinhood Chain; you pick the Stock Tokens',
  'and their weights, and the limits it can never pass are set in that contract.',
  'Every hour this agent checks each running desk and decides only when to act: now, in part, at the reopen, or',
  'not at all. Every decision, including doing nothing, is recorded, fingerprinted on-chain, and graded at the',
  'reopen. Start in Shadow (it only says what it would do), then Ask first (Telegram approvals), then On its own.',
].join(' ')

const EXPECTED =
  'One recorded decision per desk per hour, with the reasons, the alternatives it turned down and its confidence, plus the on-chain transaction when it acts.'

const userApiKey = process.env.OPENSERV_USER_API_KEY
if (!userApiKey) {
  console.error('OPENSERV_USER_API_KEY is missing from .env.')
  process.exit(1)
}

try {
  const state = JSON.parse(
    readFileSync(process.env.OPENSERV_STATE_FILE ?? resolve(WORKER_ROOT, '.openserv.json'), 'utf8'),
  ) as {
    agents?: Record<string, { id?: number }>
    workflows?: Record<string, Record<string, { workspaceId?: number }>>
  }
  const agentId = state.agents?.[AGENT_NAME]?.id
  const workflowId = state.workflows?.[AGENT_NAME]?.[WORKFLOW_NAME]?.workspaceId
  if (!agentId || !workflowId)
    throw new Error('this machine has not registered the agent. Run: pnpm openserv:provision')

  const client = new PlatformClient({ apiKey: userApiKey })
  const current = await client.get<Record<string, unknown>>(`/agents/${agentId}`)

  let avatarUrl = current.avatar_url as string | null
  if (!avatarUrl) {
    const { url } = await client.erc8004.presignIpfsUrl({ workflowId })
    const form = new FormData()
    form.append(
      'file',
      new Blob([readFileSync(resolve(WORKER_ROOT, 'assets/avatar.jpg'))], { type: 'image/jpeg' }),
      'shijima.jpg',
    )
    form.append('network', 'public')
    form.append('name', 'shijima.jpg')
    const res = await fetch(url, { method: 'POST', body: form })
    if (!res.ok) throw new Error(`IPFS upload answered ${res.status}: ${await res.text()}`)
    const cid = ((await res.json()) as { data?: { cid?: string } }).data?.cid
    if (!cid) throw new Error('IPFS upload returned no CID')
    avatarUrl = `https://gateway.pinata.cloud/ipfs/${cid}`
  }

  const submit = process.argv.includes('--submit')
  await client.put(`/agents/${agentId}`, {
    name: current.name,
    capabilities_description: current.capabilities_description,
    endpoint_url: current.endpoint_url,
    kind: 'external',
    is_built_by_agent_builder: false,
    approval_status: submit ? 'pending' : (current.approval_status ?? 'in-development'),
    is_listed_on_marketplace: current.is_listed_on_marketplace ?? false,
    is_trading_agent: true,
    scopes: current.scopes && !Array.isArray(current.scopes) ? current.scopes : {},
    avatar_url: avatarUrl,
    categoryIds: CATEGORY_IDS,
    usage_instructions: USAGE,
    expected_output: EXPECTED,
    ...(process.env.REPOSITORY_URL ? { repository_url: process.env.REPOSITORY_URL } : {}),
  })

  const after = await client.get<Record<string, unknown>>(`/agents/${agentId}`)
  const keys = [
    'approval_status',
    'is_listed_on_marketplace',
    'is_trading_agent',
    'avatar_url',
    'categories',
    'usage_instructions',
    'expected_output',
    'repository_url',
  ]
  console.log(JSON.stringify(Object.fromEntries(keys.map((k) => [k, after[k]])), null, 2))
} catch (e) {
  console.error(errorText(e))
  process.exitCode = 1
}

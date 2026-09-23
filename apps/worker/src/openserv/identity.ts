/**
 *   pnpm openserv:identity    register Shijima's ERC-8004 identity on Base, or refresh its card if we hold one
 *
 * Not the SDK's `registerOnChain`: the workspace came with a sample card and the id 8453:999999918, a token that
 * does not exist on Base, and the SDK treats any saved id as a re-deploy and would try to rewrite that token. Here
 * a saved id counts as ours only if our key owns it on-chain; otherwise we mint a fresh one. The card is our own
 * (no x402 services: nothing on the workspace is for sale). Gas on Base is a fraction of a cent, paid by the
 * deployer key. Afterwards the id, card and transaction are saved to OpenServ the same way the SDK saves them.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { errorText } from '@desk/shared'
import { PlatformClient } from '@openserv-labs/client'
import { createPublicClient, createWalletClient, decodeEventLog, http, parseAbi } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base } from 'viem/chains'
import { WORKER_ROOT } from '../cli/context'
import { AGENT_DESCRIPTION, AGENT_NAME } from './agent'

const WORKFLOW_NAME = 'Hourly desk review'
const REGISTRY = '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432' // ERC-8004 identity registry on Base
const RPC = 'https://mainnet.base.org'
const abi = parseAbi([
  'function register(string agentURI) returns (uint256)',
  'function setAgentURI(uint256 agentId, string newURI)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
])

const userApiKey = process.env.OPENSERV_USER_API_KEY
const key = process.env.DEPLOYER_PRIVATE_KEY as `0x${string}` | undefined
if (!userApiKey || !key) {
  console.error('OPENSERV_USER_API_KEY and DEPLOYER_PRIVATE_KEY must both be in .env.')
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
  const [wallet, agent] = await Promise.all([
    client.workflows.getWallet({ id: workflowId }),
    client.get<{ avatar_url?: string | null }>(`/agents/${agentId}`),
  ])
  const account = privateKeyToAccount(key)
  const pub = createPublicClient({ chain: base, transport: http(RPC) })

  // A saved id is ours only if our key owns that token on Base.
  const saved = wallet.erc8004AgentId?.match(/^8453:(\d+)$/)?.[1]
  const savedToken = saved ? BigInt(saved) : null
  const owner =
    savedToken === null
      ? null
      : await pub
          .readContract({ address: REGISTRY, abi, functionName: 'ownerOf', args: [savedToken] })
          .catch(() => null)
  const ours = owner?.toLowerCase() === account.address.toLowerCase() ? savedToken : null

  const services: { name: string; endpoint: string }[] = [
    { name: 'OpenServ', endpoint: `https://platform.openserv.ai/agents/${agentId}` },
  ]
  if (process.env.PUBLIC_APP_URL) services.push({ name: 'web', endpoint: process.env.PUBLIC_APP_URL })
  if (wallet.address) services.push({ name: 'agentWallet', endpoint: `eip155:8453:${wallet.address}` })
  const card = {
    type: 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1',
    name: 'Shijima',
    description: AGENT_DESCRIPTION,
    ...(agent.avatar_url ? { image: agent.avatar_url } : {}),
    services,
    ...(ours !== null
      ? { registrations: [{ agentId: Number(ours), agentRegistry: `eip155:8453:${REGISTRY}` }] }
      : {}),
    active: true,
    x402support: false,
  }
  const cardJson = JSON.stringify(card)

  const { url } = await client.erc8004.presignIpfsUrl({ workflowId })
  const form = new FormData()
  form.append('file', new Blob([cardJson], { type: 'application/json' }), 'registration.json')
  form.append('network', 'public')
  form.append('name', 'shijima-registration.json')
  const up = await fetch(url, { method: 'POST', body: form })
  if (!up.ok) throw new Error(`IPFS upload answered ${up.status}: ${await up.text()}`)
  const cid = ((await up.json()) as { data?: { cid?: string } }).data?.cid
  if (!cid) throw new Error('IPFS upload returned no CID')

  const writer = createWalletClient({ account, chain: base, transport: http(RPC) })
  let token: bigint
  let hash: `0x${string}`
  if (ours !== null) {
    hash = await writer.writeContract({
      address: REGISTRY,
      abi,
      functionName: 'setAgentURI',
      args: [ours, `ipfs://${cid}`],
    })
    await pub.waitForTransactionReceipt({ hash })
    token = ours
  } else {
    hash = await writer.writeContract({
      address: REGISTRY,
      abi,
      functionName: 'register',
      args: [`ipfs://${cid}`],
    })
    const receipt = await pub.waitForTransactionReceipt({ hash })
    if (receipt.status !== 'success') throw new Error(`register reverted: ${hash}`)
    const minted = receipt.logs
      .filter((l) => l.address.toLowerCase() === REGISTRY.toLowerCase())
      .map((l) => {
        try {
          return decodeEventLog({ abi, data: l.data, topics: l.topics })
        } catch {
          return null
        }
      })
      .find((e) => e?.eventName === 'Transfer')
    if (minted?.eventName !== 'Transfer') throw new Error(`no Transfer event in ${hash}`)
    token = minted.args.tokenId
  }

  await client.erc8004.deploy({
    workflowId,
    erc8004AgentId: `8453:${token}`,
    stringifiedAgentCard: cardJson,
    latestDeploymentTransactionHash: hash,
    latestDeploymentTimestamp: new Date(),
    ...(wallet.address ? { walletAddress: wallet.address } : {}),
    network: 'base',
    chainId: 8453,
    rpcUrl: RPC,
  })
  console.log(
    JSON.stringify(
      {
        agentId: `8453:${token}`,
        tx: `https://basescan.org/tx/${hash}`,
        card: `https://gateway.pinata.cloud/ipfs/${cid}`,
        scan: `https://www.8004scan.io/agents/base/${token}`,
      },
      null,
      2,
    ),
  )
} catch (e) {
  console.error(errorText(e))
  process.exitCode = 1
}

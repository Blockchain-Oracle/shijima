/**
 * Creates and inspects the dev test desk. LOCAL DEVELOPMENT ONLY, small amounts.
 * The dev wallet plays the part of a user here: it owns the desk. The agent wallet is the desk's operator.
 *
 *   pnpm dev:desk create        create the desk (once). Tiny caps: $5 per action, $15 per day.
 *   pnpm dev:desk fund [usdg]   move USDG from the dev wallet into the desk. Default: all of it.
 *   pnpm dev:desk status        owner, operator, caps, record chain, balances
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  APPROVED_TOKENS,
  deskAbi,
  deskFactoryAbi,
  erc20Abi,
  makePublicClient,
  OFFICIAL_RPC,
  USDG,
  VAULT,
} from '@desk/chain'
import { errorText, registerSecretsFromEnv } from '@desk/shared'
import { type Address, createWalletClient, formatUnits, type Hex, http, parseUnits, zeroHash } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { robinhood } from 'viem/chains'

registerSecretsFromEnv(process.env)

// DEPLOYMENTS_FILE and RPC_URL exist so the whole flow can be rehearsed on a local fork without touching real state.
const DEPLOYMENTS =
  process.env.DEPLOYMENTS_FILE ?? resolve(import.meta.dirname, '../packages/chain/deployments.json')
const PER_ACTION_CAP = parseUnits('5', 6)
const DAILY_CAP = parseUnits('15', 6)

function need(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`${name} is missing from .env`)
  return v
}
const owner = privateKeyToAccount(need('DEPLOYER_PRIVATE_KEY') as Hex)
const operator = need('OPERATOR_ADDRESS') as Address
const alchemy = process.env.ALCHEMY_KEY
  ? `https://robinhood-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_KEY}`
  : OFFICIAL_RPC
// A set RPC_URL means a local rehearsal. Then it is the ONLY endpoint, with no fallback to the real chain.
const rpc = process.env.RPC_URL ?? alchemy
const pub = makePublicClient(process.env.RPC_URL ? [rpc] : [rpc, OFFICIAL_RPC])
console.log(process.env.RPC_URL ? `REHEARSAL on ${rpc}` : 'LIVE on Robinhood Chain mainnet')
const wallet = createWalletClient({ account: owner, chain: robinhood, transport: http(rpc) })

type Deployments = Record<string, { factory: Address; implementation: Address; devDesk?: Address }> & {
  current?: string
}
function deployment() {
  if (!existsSync(DEPLOYMENTS)) throw new Error('No deployments.json. Run contracts/deploy.sh first.')
  const all = JSON.parse(readFileSync(DEPLOYMENTS, 'utf8')) as Deployments
  const label = all.current as string
  const d = all[label]
  if (!d) throw new Error(`deployments.json has no entry for "${label}"`)
  return { all, label, d }
}

async function create() {
  const { all, label, d } = deployment()
  const existing = await pub.readContract({
    address: d.factory,
    abi: deskFactoryAbi,
    functionName: 'desksOf',
    args: [owner.address],
  })
  if (existing.length > 0) return console.log(`desk already exists: ${existing[0]}`)

  const cfg = {
    operator,
    perActionCapUsdg: PER_ACTION_CAP,
    dailyCapUsdg: DAILY_CAP,
    tokens: APPROVED_TOKENS.map((t) => t.address),
    fees: APPROVED_TOKENS.map((t) => t.pinnedFee),
    feeds: APPROVED_TOKENS.map((t) => t.feed),
  }
  const predicted = await pub.readContract({
    address: d.factory,
    abi: deskFactoryAbi,
    functionName: 'predictDesk',
    args: [owner.address, zeroHash],
  })
  const { request } = await pub.simulateContract({
    account: owner,
    address: d.factory,
    abi: deskFactoryAbi,
    functionName: 'createDesk',
    args: [cfg, zeroHash],
  })
  const hash = await wallet.writeContract(request)
  const receipt = await pub.waitForTransactionReceipt({ hash, timeout: 180_000 })
  if (receipt.status !== 'success') throw new Error(`createDesk reverted, tx ${hash}`)

  all[label] = { ...d, devDesk: predicted }
  writeFileSync(DEPLOYMENTS, `${JSON.stringify(all, null, 2)}\n`)
  console.log(
    `desk created: ${predicted}\n  tx ${hash}, gas used ${receipt.gasUsed}\n  ${APPROVED_TOKENS.length} tokens allowed, operator ${operator}`,
  )
}

async function fund(amountArg?: string) {
  const { d } = deployment()
  if (!d.devDesk) throw new Error('No dev desk yet. Run: pnpm dev:desk create')
  const balance = await pub.readContract({
    address: USDG,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [owner.address],
  })
  const amount = amountArg ? parseUnits(amountArg, 6) : balance
  if (amount === 0n || amount > balance)
    throw new Error(`dev wallet holds ${formatUnits(balance, 6)} USDG, cannot send ${formatUnits(amount, 6)}`)
  // A desk needs no deposit function. It counts what it holds, so a plain transfer is a deposit.
  const hash = await wallet.writeContract({
    address: USDG,
    abi: [
      {
        type: 'function',
        name: 'transfer',
        stateMutability: 'nonpayable',
        inputs: [
          { name: 'to', type: 'address' },
          { name: 'amount', type: 'uint256' },
        ],
        outputs: [{ type: 'bool' }],
      },
    ],
    functionName: 'transfer',
    args: [d.devDesk, amount],
  })
  await pub.waitForTransactionReceipt({ hash, timeout: 120_000 })
  console.log(`moved ${formatUnits(amount, 6)} USDG into the desk, tx ${hash}`)
}

async function status() {
  const { label, d } = deployment()
  console.log(`deployment ${label}: factory ${d.factory}`)
  if (!d.devDesk) return console.log('no dev desk yet')
  const desk = { address: d.devDesk, abi: deskAbi } as const
  const [deskOwner, deskOperator, paused, seq, head, perAction, daily, remaining] = await Promise.all([
    pub.readContract({ ...desk, functionName: 'owner' }),
    pub.readContract({ ...desk, functionName: 'operator' }),
    pub.readContract({ ...desk, functionName: 'paused' }),
    pub.readContract({ ...desk, functionName: 'seq' }),
    pub.readContract({ ...desk, functionName: 'head' }),
    pub.readContract({ ...desk, functionName: 'perActionCapUsdg' }),
    pub.readContract({ ...desk, functionName: 'dailyCapUsdg' }),
    pub.readContract({ ...desk, functionName: 'remainingDailyCap' }),
  ])
  console.log(`desk ${d.devDesk}\n  owner ${deskOwner}\n  operator ${deskOperator}\n  paused ${paused}`)
  console.log(
    `  caps: $${formatUnits(perAction, 6)} per action, $${formatUnits(daily, 6)} per day, $${formatUnits(remaining, 6)} left today`,
  )
  console.log(`  record: ${seq} entries, head ${head}`)
  const holdings = [
    { symbol: 'USDG', address: USDG, decimals: 6 },
    { symbol: 'vault shares', address: VAULT, decimals: 18 },
    ...APPROVED_TOKENS,
  ]
  for (const t of holdings) {
    const b = await pub.readContract({
      address: t.address,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [d.devDesk],
    })
    if (b > 0n) console.log(`  holds ${formatUnits(b, t.decimals)} ${t.symbol}`)
  }
}

const [command = 'status', arg] = process.argv.slice(2)
const run = { create, status, fund: () => fund(arg) }[command]
if (!run) throw new Error(`unknown command "${command}". Use create, fund or status.`)
run().catch((e) => {
  console.error(errorText(e))
  process.exit(1)
})

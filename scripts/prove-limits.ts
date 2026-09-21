/**
 * Proves that the desk's limits are held by the CONTRACT, not by our code. It uses the operator key, the very
 * key a thief would steal, and asks the contract to do what the owner never allowed.
 *
 *   pnpm dev:prove-limits          simulate each case and name the error the contract answers with. Free.
 *   pnpm dev:prove-limits --send   also send the cases marked below for real, so a reverted transaction
 *                                  exists on the explorer. Costs a few cents of gas. Nothing else can move.
 *
 * Set RPC_URL to rehearse on a local fork. LOCAL DEVELOPMENT ONLY, dev desk and dev keys.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  APPROVED_TOKENS,
  deadlineIn,
  deskAbi,
  EXPLORER,
  makePublicClient,
  readDeskState,
  revertName,
  USDG,
  VAULT,
} from '@desk/chain'
import { registerSecretsFromEnv } from '@desk/shared'
import {
  type Address,
  createWalletClient,
  encodeFunctionData,
  formatUnits,
  type Hex,
  http,
  keccak256,
  toBytes,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { robinhood } from 'viem/chains'

registerSecretsFromEnv(process.env)

const send = process.argv.includes('--send')
const key = process.env.OPERATOR_PRIVATE_KEY
if (!key) throw new Error('OPERATOR_PRIVATE_KEY is missing from .env')
const rpc = process.env.RPC_URL ?? `https://robinhood-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_KEY}`
console.log(process.env.RPC_URL ? `REHEARSAL on ${rpc}` : 'LIVE on Robinhood Chain mainnet')

const deployments = JSON.parse(
  readFileSync(
    process.env.DEPLOYMENTS_FILE ?? resolve(import.meta.dirname, '../packages/chain/deployments.json'),
    'utf8',
  ),
)
const desk = deployments[deployments.current].devDesk as Address
const pub = makePublicClient([rpc])
const account = privateKeyToAccount(key as Hex)
const wallet = createWalletClient({ account, chain: robinhood, transport: http(rpc) })

const state = await readDeskState(pub, desk)
if (state.operator.toLowerCase() !== account.address.toLowerCase())
  throw new Error('this key is not the desk operator')
const nvda = APPROVED_TOKENS.find((t) => t.symbol === 'NVDA')
if (!nvda) throw new Error('NVDA is not on the approved list')

const deadline = await deadlineIn(pub, 600)
const hash = keccak256(toBytes('prove-limits: a deliberate attempt to break a limit'))
const overCap = state.perActionCapUsdg + 1_000_000n

const cases: { name: string; expect: string; sendForReal: boolean; data: Hex }[] = [
  {
    name: `buy ${formatUnits(overCap, 6)} USDG when the per-action limit is ${formatUnits(state.perActionCapUsdg, 6)}`,
    expect: 'OverPerActionCap',
    sendForReal: true,
    data: encodeFunctionData({
      abi: deskAbi,
      functionName: 'buy',
      args: [nvda.address, overCap, 0n, deadline, hash],
    }),
  },
  {
    name: 'withdraw 1 USDG from the desk with the operator key',
    expect: 'NotOwner',
    sendForReal: true,
    data: encodeFunctionData({ abi: deskAbi, functionName: 'withdraw', args: [USDG, 1_000_000n] }),
  },
  {
    name: 'buy a token the owner never allowed',
    expect: 'TokenNotConfigured',
    sendForReal: false,
    data: encodeFunctionData({
      abi: deskAbi,
      functionName: 'buy',
      args: [VAULT, 1_000_000n, 0n, deadline, hash],
    }),
  },
  {
    name: 'raise the limits with the operator key',
    expect: 'NotOwner',
    sendForReal: false,
    data: encodeFunctionData({ abi: deskAbi, functionName: 'setLimits', args: [10n ** 12n, 10n ** 12n] }),
  },
]

/** The error the contract answers with, by asking the node to run the call. undefined means it did NOT revert. */
async function refusal(data: Hex, blockNumber?: bigint): Promise<string | undefined> {
  try {
    await pub.call({ account: account.address, to: desk, data, ...(blockNumber ? { blockNumber } : {}) })
    return undefined
  } catch (e) {
    return revertName(e) ?? 'an unnamed revert'
  }
}

const before = await readDeskState(pub, desk)
let failed = false
for (const c of cases) {
  const simulated = await refusal(c.data)
  const ok = simulated === c.expect
  failed ||= !ok
  console.log(`\n${ok ? 'HELD' : 'BROKEN'}  ${c.name}`)
  console.log(`      the contract answers: ${simulated ?? 'NOTHING, THE CALL WOULD SUCCEED'}`)
  if (!ok || !send || !c.sendForReal) continue

  // Naming the gas ourselves skips the estimate, which would refuse to send a transaction it knows will fail.
  const txHash = await wallet.sendTransaction({ to: desk, data: c.data, gas: 400_000n })
  const receipt = await pub.waitForTransactionReceipt({ hash: txHash, timeout: 180_000 })
  const onChain = await refusal(c.data, receipt.blockNumber)
  const reverted = receipt.status === 'reverted'
  failed ||= !reverted
  console.log(
    `      sent for real: ${reverted ? 'REVERTED on-chain' : 'DID NOT REVERT'}, reason ${onChain}, gas used ${receipt.gasUsed}`,
  )
  console.log(process.env.RPC_URL ? `      fork tx ${txHash}` : `      ${EXPLORER}/tx/${txHash}`)
}

const after = await readDeskState(pub, desk)
const untouched =
  after.usdg === before.usdg &&
  after.seq === before.seq &&
  after.head === before.head &&
  after.perActionCapUsdg === before.perActionCapUsdg &&
  after.dailyCapUsdg === before.dailyCapUsdg
console.log(
  `\ndesk afterwards: ${formatUnits(after.usdg, 6)} USDG, record at ${after.seq}, limits unchanged: ${untouched ? 'yes, nothing moved' : 'NO'}`,
)
if (failed || !untouched) {
  console.error('A LIMIT DID NOT HOLD. Stop and investigate before anything else.')
  process.exit(1)
}

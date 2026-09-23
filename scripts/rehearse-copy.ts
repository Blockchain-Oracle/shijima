/**
 * REHEARSAL ONLY. Makes a second agent on a local fork to copy the showcase, so copy trading can be proven end to
 * end without a cent of real money. It refuses to run unless RPC_URL is a local fork.
 *
 *   RPC_URL=http://127.0.0.1:8545 pnpm rehearse:copy [usdg]
 *
 * The follower is owned by anvil's first account, which the fork signs for. Its USDG is lent by the QQQ pool,
 * impersonated on the fork. It gets its own Desk contract from the v1 factory with Shijima's operator, is registered
 * in desk_rehearsal, takes the showcase's mandate with its own limits, and runs on its own.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { APPROVED_TOKENS, deskFactoryAbi, erc20Abi, makePublicClient, USDG } from '@desk/chain'
import {
  applyMandate,
  createDb,
  currentMandate,
  databaseName,
  findDeskByAddress,
  mandateFromRow,
  markDeskDeployed,
  registerDesk,
  startDesk,
} from '@desk/db'
import { registerSecretsFromEnv } from '@desk/shared'
import {
  type Address,
  createWalletClient,
  formatUnits,
  type Hex,
  http,
  keccak256,
  parseUnits,
  toBytes,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { robinhood } from 'viem/chains'

registerSecretsFromEnv(process.env)
const rpc = process.env.RPC_URL
if (!rpc || !/^http:\/\/(127\.0\.0\.1|localhost):/.test(rpc))
  throw new Error('REHEARSAL ONLY: set RPC_URL to a local fork')
const dbUrl = process.env.REHEARSAL_DATABASE_URL
if (!dbUrl || !databaseName(dbUrl).endsWith('_rehearsal')) throw new Error('needs REHEARSAL_DATABASE_URL')
const operator = process.env.OPERATOR_ADDRESS as Address
console.log(`REHEARSAL on ${rpc}, database ${databaseName(dbUrl)}`)

// Anvil's first development account. Public knowledge, and only ever meaningful on a local fork.
const owner = privateKeyToAccount('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80')
const pub = makePublicClient([rpc])
const wallet = createWalletClient({ account: owner, chain: robinhood, transport: http(rpc) })
const rpcCall = (method: string, params: unknown[]) => pub.request({ method, params } as never)
const usdg = parseUnits(process.argv[2] ?? '30', 6)
const deployments = JSON.parse(
  readFileSync(resolve(import.meta.dirname, '../packages/chain/deployments.json'), 'utf8'),
)
const v1 = deployments.v1 as { factory: Address }
const salt = keccak256(toBytes('shijima copy follower rehearsal'))
const lender = APPROVED_TOKENS.find((t) => t.symbol === 'QQQ')?.pool as Address

await rpcCall('anvil_setBalance', [owner.address, '0xde0b6b3a7640000'])
await rpcCall('anvil_setBalance', [operator, '0xde0b6b3a7640000'])
await rpcCall('anvil_setBalance', [lender, '0xde0b6b3a7640000'])
await rpcCall('anvil_impersonateAccount', [lender])
const lend = await createWalletClient({
  account: lender,
  chain: robinhood,
  transport: http(rpc),
}).writeContract({
  address: USDG,
  abi: erc20Abi,
  functionName: 'transfer',
  args: [owner.address, usdg],
})
await pub.waitForTransactionReceipt({ hash: lend })
await rpcCall('anvil_stopImpersonatingAccount', [lender])

const predicted = await pub.readContract({
  address: v1.factory,
  abi: deskFactoryAbi,
  functionName: 'predictDesk',
  args: [owner.address, salt],
})
const code = await pub.getCode({ address: predicted })
let createTx: Hex | undefined
if (!code || code === '0x') {
  const { request } = await pub.simulateContract({
    account: owner,
    address: v1.factory,
    abi: deskFactoryAbi,
    functionName: 'createDesk',
    args: [
      {
        operator,
        perActionCapUsdg: parseUnits('20', 6),
        dailyCapUsdg: parseUnits('50', 6),
        tokens: APPROVED_TOKENS.map((t) => t.address),
        fees: APPROVED_TOKENS.map((t) => t.pinnedFee),
        feeds: APPROVED_TOKENS.map((t) => t.feed),
      },
      salt,
    ],
  })
  createTx = await wallet.writeContract(request)
  const receipt = await pub.waitForTransactionReceipt({ hash: createTx })
  if (receipt.status !== 'success') throw new Error(`createDesk reverted, tx ${createTx}`)
}
const fund = await wallet.writeContract({
  address: USDG,
  abi: erc20Abi,
  functionName: 'transfer',
  args: [predicted, usdg],
})
await pub.waitForTransactionReceipt({ hash: fund })
const held = await pub.readContract({
  address: USDG,
  abi: erc20Abi,
  functionName: 'balanceOf',
  args: [predicted],
})

const { db, pool, close } = createDb(dbUrl)
try {
  const desk = await registerDesk(db, {
    ownerAddress: owner.address,
    deskAddress: predicted,
    factory: v1.factory,
    salt,
    contractVersion: 'v1',
    operator,
    name: 'Copy follower (fork)',
  })
  await markDeskDeployed(db, desk.id, createTx ?? null)
  const leader = await findDeskByAddress(db, (deployments.v1 as { devDesk: string }).devDesk)
  const leaderMandate = leader ? await currentMandate(db, leader.id) : undefined
  if (!leaderMandate) throw new Error('the showcase has no mandate in the rehearsal database')
  if (!(await currentMandate(db, desk.id))) {
    await applyMandate(
      db,
      desk.id,
      {
        ...mandateFromRow(leaderMandate),
        perActionCapUsdg: parseUnits('20', 6),
        dailyCapUsdg: parseUnits('50', 6),
        largeActionUsdg: parseUnits('100', 6),
      },
      { actor: 'owner', via: 'worker' },
    )
  }
  await startDesk(db, desk.id)
  // The go-live checks are the owner's to earn; this is a throwaway fork, so the rehearsal sets the mode directly.
  await pool.query("update desks set mode = 'on_its_own' where id = $1", [desk.id])
  console.log(`follower ${predicted} (id ${desk.id}) holds ${formatUnits(held, 6)} USDG, running on its own`)
  if (createTx) console.log(`  createDesk tx ${createTx}`)
  console.log(`  funded with tx ${fund}`)
} finally {
  await close()
}

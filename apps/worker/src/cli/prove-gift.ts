/**
 *   pnpm --filter @desk/worker prove-gift     prove the free $1 on a LOCAL FORK. Refuses anything else.
 *
 * A throwaway gift key is funded on the fork (ETH by anvil_setBalance, USDG from a pool by impersonation), then:
 *   1. with the sender off, a claim waits and says why
 *   2. with it on, a fresh wallet gets exactly $1 USDG and 0.00008 ETH, both confirmed
 *   3. the same wallet claiming again is refused, and so is a second wallet on the same connection
 *   4. crash drill: the $1 is signed, journaled and broadcast, then the process "dies" before settling. The next
 *      pass finds the receipt, counts the $1 as paid and sends only the ETH: the wallet holds $1, not $2
 *   5. the cap: with GIFT_CAP 3, the fourth wallet is told they are all gone
 * Claims go through `queueGift`, the function the website's claim action calls. Passes are the worker's own.
 */
import { broadcast, EXPLORER, signGiftTransfer, USDG } from '@desk/chain'
import {
  GIFT_ETH_WEI,
  GIFT_USDG,
  giftOfWallet,
  journalGiftAttempt,
  queueGift,
  schema,
  startGift,
} from '@desk/db'
import { giftCopy } from '@desk/shared'
import { type Address, createWalletClient, erc20Abi, http, parseEther } from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { robinhood } from 'viem/chains'
import { giftPass } from '../gift'
import { openCli } from './context'

const cli = await openCli()
if (!cli.env.isRehearsal || !/127\.0\.0\.1|localhost/.test(cli.env.rpcUrl)) {
  throw new Error('prove-gift runs only on a local fork: set RPC_URL to the anvil fork')
}
const { db, pub } = cli
const rpc = cli.env.rpcUrl
const log = (event: string, detail: Record<string, unknown> = {}) =>
  console.log(`  · ${event} ${JSON.stringify(detail)}`)
const check = (ok: boolean, what: string) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}`)
  if (!ok) process.exitCode = 1
}
const usdgOf = (a: Address) =>
  pub.readContract({ address: USDG, abi: erc20Abi, functionName: 'balanceOf', args: [a] })
const fresh = () => privateKeyToAccount(generatePrivateKey()).address.toLowerCase() as Address
const CAP = 3

// A clean table on the rehearsal database only.
await db.delete(schema.giftClaims)

// The gift wallet: a throwaway key, funded on the fork.
const giftAccount = privateKeyToAccount(generatePrivateKey())
const wallet = createWalletClient({ account: giftAccount, chain: robinhood, transport: http(rpc) })
await pub.request({
  method: 'anvil_setBalance',
  params: [giftAccount.address, `0x${parseEther('0.01').toString(16)}`],
} as never)
const pool = '0xD60A5d14dB690B7Afad71F76B108071D7175597d' as Address // QQQ/USDG, holds USDG
await pub.request({ method: 'anvil_impersonateAccount', params: [pool] } as never)
await pub.request({
  method: 'anvil_setBalance',
  params: [pool, `0x${parseEther('1').toString(16)}`],
} as never)
const poolWallet = createWalletClient({ account: pool, chain: robinhood, transport: http(rpc) })
const funding = await poolWallet.writeContract({
  address: USDG,
  abi: erc20Abi,
  functionName: 'transfer',
  args: [giftAccount.address, 5n * GIFT_USDG],
})
await pub.waitForTransactionReceipt({ hash: funding })
console.log(`gift wallet ${giftAccount.address}: ${(await usdgOf(giftAccount.address)) / GIFT_USDG} USDG`)

// 1. Sender off.
const a = fresh()
check((await queueGift(db, { wallet: a, ipHash: 'ip-a', cap: CAP })).ok, 'wallet A claims')
await giftPass({ db, pub, wallet: undefined }, log)
const waiting = await giftOfWallet(db, a)
check(
  waiting?.status === 'queued' && waiting.error === giftCopy.senderOff,
  `sender off: A stays queued and says "${waiting?.error}"`,
)

// 2. Sender on.
await giftPass({ db, pub, wallet }, log)
const sentA = await giftOfWallet(db, a)
const aUsdg = await usdgOf(a)
const aEth = await pub.getBalance({ address: a })
check(sentA?.status === 'sent' && !sentA.error, `A is sent`)
check(aUsdg === GIFT_USDG && aEth === GIFT_ETH_WEI, `A holds ${aUsdg} USDG units and ${aEth} wei`)
for (const tx of [sentA?.usdgTx, sentA?.ethTx]) {
  const r = tx ? await pub.getTransactionReceipt({ hash: tx as `0x${string}` }) : undefined
  check(r?.status === 'success', `receipt ${tx} success in block ${r?.blockNumber}`)
}

// 3. Refusals.
const again = await queueGift(db, { wallet: a, ipHash: 'ip-other', cap: CAP })
check(
  !again.ok && again.reason === 'already',
  `A claiming again is refused (${again.ok ? 'ok' : again.reason})`,
)
const sameIp = await queueGift(db, { wallet: fresh(), ipHash: 'ip-a', cap: CAP })
check(
  !sameIp.ok && sameIp.reason === 'ip_today',
  `a new wallet on A's connection is refused (${sameIp.ok ? 'ok' : sameIp.reason})`,
)

// 4. Crash drill: the $1 goes out, the process dies before it is settled.
const c = fresh()
const queuedC = await queueGift(db, { wallet: c, ipHash: 'ip-c', cap: CAP })
if (!queuedC.ok) throw new Error('C was not queued')
await startGift(db, queuedC.row.id)
const signed = await signGiftTransfer(pub, wallet, { leg: 'usdg', to: c, amount: GIFT_USDG })
await journalGiftAttempt(db, queuedC.row.id, {
  leg: 'usdg',
  txHash: signed.txHash,
  nonce: signed.nonce,
  preparedAt: new Date().toISOString(),
})
await broadcast(pub, signed)
console.log(`  · crash after broadcast of ${signed.txHash}, before settling`)
await giftPass({ db, pub, wallet }, log)
const sentC = await giftOfWallet(db, c)
check(
  sentC?.status === 'sent' && sentC.usdgTx === signed.txHash,
  `C is sent, and its $1 is the one from before the crash`,
)
check((await usdgOf(c)) === GIFT_USDG, `C holds exactly $1 (${await usdgOf(c)} units), not $2`)
check(sentC?.attempts.filter((t) => t.leg === 'usdg').length === 1, 'C has one USDG transfer, never a second')

// 5. The cap.
const d = fresh()
check((await queueGift(db, { wallet: d, ipHash: 'ip-d', cap: CAP })).ok, 'D claims (3 of 3)')
const e = await queueGift(db, { wallet: fresh(), ipHash: 'ip-e', cap: CAP })
check(!e.ok && e.reason === 'all_gone', `E is told they are all gone (${e.ok ? 'ok' : e.reason})`)
await giftPass({ db, pub, wallet }, log)
check((await giftOfWallet(db, d))?.status === 'sent', 'D is sent')

console.log('\nfork transactions:')
for (const w of [a, c, d]) {
  const row = await giftOfWallet(db, w)
  console.log(`  ${w}  usdg ${row?.usdgTx}  eth ${row?.ethTx}`)
}
console.log(`(fork only; ${EXPLORER} will not know these)`)
await cli.close()

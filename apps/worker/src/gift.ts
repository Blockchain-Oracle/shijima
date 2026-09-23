/**
 * The gift sender: pays the free $1 the website queued, from the gift wallet. $1 of USDG first, then the ETH for
 * fees. The website never holds this key.
 *
 *   one pass   settle every claim already sending, then start at most one queued claim
 *   each leg   sign -> journal the hash -> broadcast -> wait -> settle, the operator sender's order (sender.ts)
 *
 * Never pay twice. A leg counts as paid only when a receipt says so, and a leg is signed again only when the chain
 * proves the earlier transfer cannot land: its nonce was used by something else, which with one sender and every
 * hash journaled means none of ours landed. A transfer that is merely not seen yet is re-signed ON ITS OWN NONCE,
 * so the two compete for one slot and at most one of them can ever land.
 *
 * Without GIFT_PRIVATE_KEY the sender is off: claims stay queued and each carries a note saying why.
 */
import {
  broadcast,
  giftReceipt,
  OperatorLowGasError,
  type OperatorWallet,
  signGiftTransfer,
} from '@desk/chain'
import {
  type Db,
  finishGift,
  GIFT_ETH_WEI,
  GIFT_USDG,
  type GiftRow,
  giftOfWallet,
  journalGiftAttempt,
  nextQueuedGift,
  noteQueuedGifts,
  openAttempts,
  sendingGifts,
  settleGiftAttempt,
  startGift,
} from '@desk/db'
import { errorText, giftCopy } from '@desk/shared'
import { type Address, createWalletClient, type Hex, http, type PublicClient } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { robinhood } from 'viem/chains'
import { NO_DEADLINE_GRACE_S, NODE_LAG_MARGIN_S } from './landing'
import type { Cli, Log } from './review'

const PASS_MS = 10_000
/** How long one pass waits for a receipt before leaving the transfer to the next pass. */
const RECEIPT_WAIT_MS = 60_000

export interface GiftDeps {
  db: Db
  pub: PublicClient
  /** Undefined when GIFT_PRIVATE_KEY is not set: the sender is off. */
  wallet: OperatorWallet | undefined
}

type Leg = 'usdg' | 'eth'
type LegResult =
  | { paid: true }
  | { paid: false; waiting: true }
  | { paid: false; waiting: false; error: string }

export function giftWallet(cli: Cli): OperatorWallet | undefined {
  const key = cli.env.GIFT_PRIVATE_KEY
  if (!key) return undefined
  return createWalletClient({
    account: privateKeyToAccount(key as Hex),
    chain: robinhood,
    transport: http(cli.env.rpcUrl),
  })
}

/** One pass. Returns what it did, for the log and for the proof script. */
export async function giftPass(
  deps: GiftDeps,
  log: Log,
): Promise<{ settled: number; started: string | null }> {
  if (!deps.wallet) {
    const noted = await noteQueuedGifts(deps.db, giftCopy.senderOff)
    if (noted > 0) log('gift_sender_off', { queued: noted, note: 'GIFT_PRIVATE_KEY is not set' })
    return { settled: 0, started: null }
  }
  let settled = 0
  // Anything already in flight is settled first. While one may still land, nothing new is signed: it could take
  // the nonce the waiting transfer needs.
  for (const row of await sendingGifts(deps.db)) {
    if ((await advance(deps, row, log)) === 'waiting') return { settled, started: null }
    settled++
  }
  const next = await nextQueuedGift(deps.db)
  if (!next || !(await startGift(deps.db, next.id))) return { settled, started: null }
  log('gift_started', { claim: next.id, wallet: next.wallet })
  await advance(deps, { ...next, status: 'sending' }, log)
  return { settled, started: next.id }
}

/** Pays whichever legs are unpaid, in order. `waiting` means a transfer may still land and must be left alone. */
async function advance(deps: GiftDeps, row: GiftRow, log: Log): Promise<'done' | 'waiting'> {
  let current = row
  for (const leg of ['usdg', 'eth'] as const) {
    if (paidTx(current, leg)) continue
    const result = await payLeg(deps, current, leg, log)
    if (!result.paid) {
      if (result.waiting) return 'waiting'
      await finishGift(deps.db, row.id, { status: 'failed', error: result.error })
      log('gift_failed', { claim: row.id, leg, error: result.error })
      return 'done'
    }
    current = (await giftOfWallet(deps.db, row.wallet)) ?? current
  }
  await finishGift(deps.db, row.id, { status: 'sent' })
  log('gift_sent', { claim: row.id, wallet: row.wallet, usdgTx: current.usdgTx, ethTx: current.ethTx })
  return 'done'
}

const paidTx = (row: GiftRow, leg: Leg) => (leg === 'usdg' ? row.usdgTx : row.ethTx)

/**
 * The amount a leg sends: the row's, but never more than the fixed gift. A row edited by hand cannot turn the
 * gift wallet into a faucet.
 */
function amountOf(row: GiftRow, leg: Leg): bigint {
  const asked = leg === 'usdg' ? row.usdgAmount : row.ethAmountWei
  const most = leg === 'usdg' ? GIFT_USDG : GIFT_ETH_WEI
  return asked < most ? asked : most
}

async function payLeg(deps: GiftDeps, row: GiftRow, leg: Leg, log: Log): Promise<LegResult> {
  const wallet = deps.wallet as OperatorWallet
  let replaceNonce: number | undefined
  const open = openAttempts(row, leg)
  if (open.length > 0) {
    // The mined nonce FIRST, then receipts: a nonce counted as used cannot belong to a receipt not yet visible.
    const minedNonce = await deps.pub.getTransactionCount({
      address: wallet.account.address,
      blockTag: 'latest',
    })
    for (const a of open) {
      const found = await giftReceipt(deps.pub, a.txHash as Hex)
      if (!found) continue
      await settleGiftAttempt(deps.db, row.id, a.txHash, found.status)
      // Every other open attempt shared this nonce, so none of them can land now.
      for (const other of open) {
        if (other.txHash !== a.txHash) await settleGiftAttempt(deps.db, row.id, other.txHash, 'never_landed')
      }
      if (found.status === 'confirmed') return { paid: true }
      return { paid: false, waiting: false, error: `the ${leg} transfer reverted on-chain (${a.txHash})` }
    }
    const nonce = Math.max(...open.map((a) => a.nonce))
    const newest = Math.max(...open.map((a) => Date.parse(a.preparedAt)))
    const ageS = (Date.now() - newest) / 1000
    if (minedNonce > nonce && ageS > NODE_LAG_MARGIN_S) {
      // Its nonce went to something else, and nothing of ours has a receipt: none of these can ever land.
      for (const a of open) await settleGiftAttempt(deps.db, row.id, a.txHash, 'never_landed')
      log('gift_never_landed', { claim: row.id, leg, nonce })
    } else if (minedNonce <= nonce && ageS > NO_DEADLINE_GRACE_S) {
      // Not seen for minutes and its nonce is still free: sign again ON THE SAME NONCE.
      replaceNonce = nonce
      log('gift_resign', { claim: row.id, leg, nonce })
    } else {
      return { paid: false, waiting: true }
    }
  }

  let signed: Awaited<ReturnType<typeof signGiftTransfer>>
  try {
    signed = await signGiftTransfer(deps.pub, wallet, {
      leg,
      to: row.wallet as Address,
      amount: amountOf(row, leg),
      ...(replaceNonce === undefined ? {} : { nonce: replaceNonce }),
    })
  } catch (e) {
    // A replacement that cannot be signed leaves the earlier transfer to be judged again next pass.
    if (replaceNonce !== undefined) return { paid: false, waiting: true }
    const why = e instanceof OperatorLowGasError ? 'the gift wallet is short of ETH' : errorText(e)
    return { paid: false, waiting: false, error: `refused before sending: ${why}` }
  }
  // Write-ahead: the hash is on the row before the network ever sees the transfer.
  await journalGiftAttempt(deps.db, row.id, {
    leg,
    txHash: signed.txHash.toLowerCase(),
    nonce: signed.nonce,
    preparedAt: new Date().toISOString(),
  })
  try {
    await broadcast(deps.pub, signed)
  } catch (e) {
    // Rejected or lost on the way. The journal still holds it, and the next pass asks the chain.
    log('gift_broadcast_failed', { claim: row.id, leg, error: errorText(e) })
    return { paid: false, waiting: true }
  }
  try {
    const receipt = await deps.pub.waitForTransactionReceipt({
      hash: signed.txHash,
      timeout: RECEIPT_WAIT_MS,
    })
    const status = receipt.status === 'success' ? 'confirmed' : 'reverted'
    await settleGiftAttempt(deps.db, row.id, signed.txHash, status)
    if (status === 'confirmed') return { paid: true }
    return { paid: false, waiting: false, error: `the ${leg} transfer reverted on-chain (${signed.txHash})` }
  } catch (e) {
    log('gift_receipt_late', { claim: row.id, leg, txHash: signed.txHash, error: errorText(e) })
    return { paid: false, waiting: true }
  }
}

/** Runs a pass every ten seconds beside the desk's clock, never inside it. */
export function startGiftLoop(cli: Cli, log: Log): { stop: () => Promise<void> } {
  const deps: GiftDeps = { db: cli.db, pub: cli.pub, wallet: giftWallet(cli) }
  log('gift_sender', deps.wallet ? { on: true, from: deps.wallet.account.address } : { on: false })
  let stopping = false
  let running: Promise<unknown> | undefined
  // A pass can wait up to a minute on a receipt. The next one starts only after it, never beside it.
  const timer = setInterval(() => {
    if (stopping || running) return
    running = giftPass(deps, log)
      .catch((e) => log('gift_pass_failed', { error: errorText(e) }))
      .finally(() => {
        running = undefined
      })
  }, PASS_MS)
  return {
    stop: async () => {
      stopping = true
      clearInterval(timer)
      await running
    },
  }
}

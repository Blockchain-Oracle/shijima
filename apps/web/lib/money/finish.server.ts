/**
 * How a money move ended, decided by the chain and by Relay, never by the browser. A hash the browser reports
 * proves nothing until the chain shows a transaction from the owner, to a contract the plan named, that succeeded.
 *
 * The five endings:
 *   done                every step confirmed (and Relay delivered, for a bridge)
 *   nothing_sent        nothing was signed, or what was signed reverted: no money moved
 *   approved_only       an approval landed, the move itself did not: nothing moved
 *   on_its_way          the origin transaction confirmed and Relay has not delivered yet
 *   may_have_been_sent  a transaction exists but its result could not be read in time
 */
import { erc20Abi, USDG } from '@desk/chain'
import { addMoneyMoveHash, type MoneyMoveRow, moneyMoveForOwner, settleMoneyMove } from '@desk/db'
import { moneyCopy, usd } from '@desk/shared'
import {
  createPublicClient,
  type Hex,
  http,
  isHash,
  type PublicClient,
  parseEventLogs,
  type TransactionReceipt,
} from 'viem'
import { pub } from '../chain-build.server'
import { db } from '../db'
import { moneyChain, txUrl } from './chains'
import { relayRequestUrl, relayStatus } from './relay.server'
import type { MoveEnding, MoveOutcome } from './types'

const c = moneyCopy
const APPROVE_SELECTOR = '0x095ea7b3'
const RECEIPT_TIMEOUT_MS = 30_000
const clients = new Map<number, PublicClient>()

/** A reader for the chain a move started on: Robinhood Chain through our own RPC, the others through theirs. */
function clientFor(chainId: number): PublicClient {
  if (chainId === 4663) return pub()
  const known = moneyChain(chainId)
  if (!known) throw new Error(`no RPC for chain ${chainId}`)
  let client = clients.get(chainId)
  if (!client) {
    client = createPublicClient({ chain: known.chain, transport: http(known.rpc) }) as PublicClient
    clients.set(chainId, client)
  }
  return client
}

/** The browser sent a step. Kept at once, so a closed tab never loses where the money went. */
export async function recordStep(owner: string, moveId: string, hash: string): Promise<boolean> {
  if (!isHash(hash)) return false
  const move = await moneyMoveForOwner(db(), moveId, owner)
  if (!move) return false
  await addMoneyMoveHash(db(), move.id, hash)
  return true
}

interface Checked {
  hash: Hex
  approve: boolean
  receipt: TransactionReceipt | null
}

/**
 * Each reported hash, read from its chain: only transactions from the owner to a contract the plan named count. A
 * receipt that could not be read in time is kept as null: that step may have been sent.
 */
async function readHashes(move: MoneyMoveRow, owner: string): Promise<Checked[]> {
  const client = clientFor(move.fromChainId)
  const allowed = new Set(move.steps.map((s) => s.to.toLowerCase()))
  const checked: Checked[] = []
  for (const hash of move.txHashes as Hex[]) {
    try {
      const receipt = await client.waitForTransactionReceipt({ hash, timeout: RECEIPT_TIMEOUT_MS })
      const tx = await client.getTransaction({ hash })
      if (tx.from.toLowerCase() !== owner.toLowerCase() || !tx.to || !allowed.has(tx.to.toLowerCase()))
        continue
      checked.push({ hash, approve: tx.input.startsWith(APPROVE_SELECTOR), receipt })
    } catch {
      checked.push({ hash, approve: false, receipt: null })
    }
  }
  return checked
}

/** What actually landed for the recipient, from the transfer events of the last step. Null when not readable. */
function landed(move: MoneyMoveRow, receipt: TransactionReceipt): bigint | null {
  const logs = parseEventLogs({ abi: erc20Abi, logs: receipt.logs, eventName: 'Transfer' })
  const into = logs.filter(
    (l) =>
      l.address.toLowerCase() === move.tokenOut.toLowerCase() &&
      l.args.to.toLowerCase() === move.recipient.toLowerCase(),
  )
  if (into.length === 0) return null
  return into.reduce((s, l) => s + l.args.value, 0n)
}

/** The move in dollars: what landed when it was USDG, otherwise what it was worth when planned. */
const dollarsOf = (move: MoneyMoveRow, actual: bigint | null) =>
  usd(move.tokenOut.toLowerCase() === USDG.toLowerCase() && actual !== null ? actual : (move.usdgValue ?? 0n))

function outcomeOf(move: MoneyMoveRow, ending: MoveEnding | 'signing', checked: Checked[]): MoveOutcome {
  const amount = dollarsOf(move, move.amountOutActual)
  const text =
    ending === 'signing'
      ? c.endings.signing
      : ending === 'done'
        ? c.endings.done(amount)
        : ending === 'on_its_way'
          ? c.endings.on_its_way(amount)
          : c.endings[ending]
  return {
    moveId: move.id,
    ending,
    text,
    links: (checked.length > 0 ? checked.map((x) => x.hash) : (move.txHashes as Hex[])).map((hash) => ({
      chainId: move.fromChainId,
      hash,
      url: txUrl(move.fromChainId, hash),
    })),
    relayUrl: move.relayRequestId ? relayRequestUrl(move.relayRequestId) : null,
    open: ending === 'on_its_way' || ending === 'may_have_been_sent',
  }
}

/**
 * Settles a move from the chain. Safe to call again: a move on its way is checked with Relay each time, and an
 * ending that is final stays as it was. `note` is the browser's own account when nothing was sent (the owner
 * said no, or the wallet refused), kept only as the reason.
 */
export async function finishMove(owner: string, moveId: string, note?: string): Promise<MoveOutcome | null> {
  const move = await moneyMoveForOwner(db(), moveId, owner)
  if (!move) return null
  if (move.status === 'done' || move.status === 'nothing_sent' || move.status === 'approved_only')
    return outcomeOf(move, move.status, [])

  const settle = async (
    status: MoveEnding,
    extra: { amountOutActual?: bigint | null; error?: string | null } = {},
  ) => {
    const row = (await settleMoneyMove(db(), move.id, { status, ...extra })) ?? move
    return row
  }

  if (move.txHashes.length === 0) {
    const row = await settle('nothing_sent', { error: note ?? null })
    return outcomeOf(row, 'nothing_sent', [])
  }

  const checked = await readHashes(move, owner)
  const approvals = checked.filter((x) => x.approve && x.receipt?.status === 'success')
  const main = checked.filter((x) => !x.approve)
  const plannedMain = move.steps.filter((s) => s.kind !== 'approve').length
  const mainOk = main.filter((x) => x.receipt?.status === 'success')
  const nothingMoved = (why: string) =>
    approvals.length > 0 ? settle('approved_only', { error: why }) : settle('nothing_sent', { error: why })

  if (main.some((x) => x.receipt?.status === 'reverted')) {
    const row = await nothingMoved('the chain refused the transaction')
    return outcomeOf(row, row.status as MoveEnding, checked)
  }
  if (main.some((x) => x.receipt === null)) {
    const row = await settle('may_have_been_sent')
    return outcomeOf(row, 'may_have_been_sent', checked)
  }
  if (mainOk.length < plannedMain) {
    const row = await nothingMoved(note ?? 'not every step was signed')
    return outcomeOf(row, row.status as MoveEnding, checked)
  }

  // Every step landed on the origin chain.
  const last = mainOk.at(-1)?.receipt
  const actual = last && move.fromChainId === move.toChainId ? landed(move, last) : null
  if (move.relayRequestId) {
    const relayed = await relayStatus(move.relayRequestId)
    if (relayed.state === 'success') {
      const row = await settle('done')
      return outcomeOf(row, 'done', checked)
    }
    if (relayed.state === 'refund') {
      const row = await settle('nothing_sent', { error: 'Relay could not fill it and refunded it' })
      return outcomeOf(row, 'nothing_sent', checked)
    }
    if (relayed.state === 'failure') {
      const row = await settle('may_have_been_sent', { error: 'Relay reported a failure' })
      return outcomeOf(row, 'may_have_been_sent', checked)
    }
    const row = await settle('on_its_way')
    return outcomeOf(row, 'on_its_way', checked)
  }
  // Native ETH sent as it is has no transfer event: the amount is the value the transaction carried.
  const row = await settle('done', {
    amountOutActual: actual ?? (move.tokenIn === move.tokenOut ? move.amountIn : null),
  })
  return outcomeOf(row, 'done', checked)
}

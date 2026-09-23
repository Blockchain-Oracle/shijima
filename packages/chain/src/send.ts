/**
 * Operator transactions in separate steps, so the caller can save the hash BEFORE anything is broadcast:
 *
 *   signDeskCall   simulate (a revert costs nothing and names its cause), then build and sign. Not sent.
 *   broadcast      hand the signed bytes to the network
 *   waitForOutcome wait for the receipt and read the contract's event back
 *   findOutcome    the same without waiting. This is what crash recovery uses: did this hash ever land?
 *
 * The signed bytes live in memory only. A signed transaction is a bearer instrument, so it is never stored.
 * Everything takes explicit clients, so the same code runs against mainnet, a local fork, and tests.
 */

import type { Address } from 'viem'
import {
  BaseError,
  ContractFunctionRevertedError,
  decodeErrorResult,
  encodeFunctionData,
  type Hex,
  isHex,
  keccak256,
  type PublicClient,
  parseEventLogs,
  type TransactionReceipt,
  TransactionReceiptNotFoundError,
} from 'viem'
import type { OperatorWallet } from './desk'
import { deskAbi } from './generated/desk-abi'
import { deskAbiV0 } from './generated/desk-abi-v0'

/**
 * The contract version a desk runs, as stored on its row (`desks.contract_version`). v0 desks keep speaking the
 * frozen v0 ABI. Every later version speaks the current source. The two differ only where v1 added deadlines
 * (`checkpoint`, `sweepToVault`, `redeemFromVault`); events and errors in v1 are a superset of v0's, so one
 * decoder reads receipts and refusals from both.
 */
export const isV0Desk = (version: string) => version === 'v0'

/** How long a v1 checkpoint may wait to land. Past it, the transaction can never land, which makes recovery safe. */
const CHECKPOINT_DEADLINE_S = 300

export type DeskCall =
  | {
      kind: 'buy' | 'sell'
      desk: Address
      /** The desk's contract version, from its row. */
      version: string
      token: Address
      amountIn: bigint
      minOut: bigint
      deadline: number
      decisionHash: Hex
    }
  | { kind: 'checkpoint'; desk: Address; version: string; decisionHash: Hex }
  /**
   * The desk pausing ITSELF, on the second consecutive check below the owner's loss limit. `pause()` takes no
   * arguments and no deadline on purpose, so the owner can call it from an explorer too. It carries no decision
   * hash and advances nothing, so it seals no record.
   */
  | { kind: 'pause'; desk: Address; version: string }
  /**
   * Idle cash into the savings vault (`amountIn` is USDG), or shares back out of it (`amountIn` is shares).
   * v1 and later only: v0's vault calls carry no deadline, so a lost one could never be declared dead.
   */
  | {
      kind: 'sweep' | 'redeem'
      desk: Address
      version: string
      amountIn: bigint
      deadline: number
      decisionHash: Hex
    }

export interface SignedDeskCall {
  kind: DeskCall['kind']
  desk: Address
  /** The raw signed transaction. Memory only. */
  serialized: Hex
  /** keccak256 of the signed bytes: the hash the network will report, known before it is sent. */
  txHash: Hex
  nonce: number
  calldataHash: Hex
  /** The contract's own deadline. Buy, sell and the vault calls always have one; so does a v1 checkpoint. */
  deadlineUnix?: number
}

export type DeskOutcome =
  | {
      status: 'confirmed'
      txHash: Hex
      blockNumber: bigint
      gasUsed: bigint
      effectiveGasPrice: bigint
      /** The contract's own sequence number, from its event. */
      chainSeq: bigint
      /** The decision hash the contract emitted. It must equal the record's fingerprint. */
      eventHash: Hex
      amountOut?: bigint
      feedPrice?: bigint
    }
  | { status: 'reverted'; txHash: Hex; blockNumber: bigint; gasUsed: bigint; effectiveGasPrice: bigint }

/** The operator wallet cannot cover the most this transaction could cost. Nothing was signed. */
export class OperatorLowGasError extends Error {
  constructor(
    readonly balance: bigint,
    readonly needed: bigint,
  ) {
    super(`the operator wallet holds ${balance} wei but this transaction could cost up to ${needed} wei`)
    this.name = 'OperatorLowGasError'
  }
}

/**
 * The contract's custom error name behind a refused call, for example OverPerActionCap.
 * A revert found by `simulateContract` arrives decoded. One found during gas estimation arrives as raw bytes,
 * so those are decoded here against the desk ABI. A name the owner can read beats "custom error 0x70f65caa".
 */
export function revertName(error: unknown): string | undefined {
  if (!(error instanceof BaseError)) return undefined
  const reverted = error.walk((e) => e instanceof ContractFunctionRevertedError)
  if (reverted instanceof ContractFunctionRevertedError && reverted.data?.errorName) {
    return reverted.data.errorName
  }
  const withData = error.walk((e) => isHex((e as { data?: unknown }).data)) as { data?: Hex } | null
  const raw = withData?.data ?? error.message.match(/custom error (0x[0-9a-fA-F]{8})/)?.[1]
  if (!raw || !isHex(raw)) return undefined
  try {
    return decodeErrorResult({ abi: deskAbi, data: raw }).errorName
  } catch {
    return undefined
  }
}

/** Exactly what gets signed: the prepared request with its pinned nonce and the gas headroom applied. */
export interface PreparedDeskTx {
  chainId: number
  to: Address
  data: Hex
  nonce: number
  gas: bigint
  maxFeePerGas?: bigint
  maxPriorityFeePerGas?: bigint
  gasPrice?: bigint
}

/**
 * Something other than the wallet client that turns a prepared request into signed bytes: the worker's Coinbase
 * AgentKit wallet provider. Same key, same bytes; only who holds the pen changes.
 */
export type DeskTxSigner = (tx: PreparedDeskTx) => Promise<Hex>

export async function signDeskCall(
  pub: PublicClient,
  wallet: OperatorWallet,
  call: DeskCall,
  signer?: DeskTxSigner,
): Promise<SignedDeskCall> {
  const account = wallet.account
  // Separate call sites, because viem types each contract function separately and cannot take a union of them.
  let data: Hex
  let deadlineUnix: number | undefined
  if (call.kind === 'pause') {
    // The same in every version.
    await pub.simulateContract({ account, address: call.desk, abi: deskAbi, functionName: 'pause' })
    data = encodeFunctionData({ abi: deskAbi, functionName: 'pause' })
  } else if (call.kind === 'sweep' || call.kind === 'redeem') {
    if (isV0Desk(call.version)) throw new Error('a v0 desk does not use the savings vault')
    const functionName = call.kind === 'sweep' ? 'sweepToVault' : 'redeemFromVault'
    const args = [call.amountIn, call.deadline, call.decisionHash] as const
    await pub.simulateContract({ account, address: call.desk, abi: deskAbi, functionName, args })
    data = encodeFunctionData({ abi: deskAbi, functionName, args })
    deadlineUnix = call.deadline
  } else if (call.kind === 'buy' || call.kind === 'sell') {
    const args = [call.token, call.amountIn, call.minOut, call.deadline, call.decisionHash] as const
    // buy and sell are the same shape in every version.
    await pub.simulateContract({ account, address: call.desk, abi: deskAbi, functionName: call.kind, args })
    data = encodeFunctionData({ abi: deskAbi, functionName: call.kind, args })
    deadlineUnix = call.deadline
  } else if (isV0Desk(call.version)) {
    const args = [call.decisionHash] as const
    await pub.simulateContract({
      account,
      address: call.desk,
      abi: deskAbiV0,
      functionName: 'checkpoint',
      args,
    })
    data = encodeFunctionData({ abi: deskAbiV0, functionName: 'checkpoint', args })
  } else {
    deadlineUnix = await deadlineIn(pub, CHECKPOINT_DEADLINE_S)
    const args = [deadlineUnix, call.decisionHash] as const
    await pub.simulateContract({
      account,
      address: call.desk,
      abi: deskAbi,
      functionName: 'checkpoint',
      args,
    })
    data = encodeFunctionData({ abi: deskAbi, functionName: 'checkpoint', args })
  }
  // Pin the nonce to what is MINED, not to what is pending. If an earlier transaction is stuck, the next one
  // must REPLACE it rather than queue behind it: two desk actions from one decision must never both land.
  // It is also what makes "it never landed" safe to act on, because reusing its nonce is what voids it.
  const nonce = await pub.getTransactionCount({ address: wallet.account.address, blockTag: 'latest' })
  const request = await wallet.prepareTransactionRequest({ to: call.desk, data, nonce })
  // Only gas actually used is charged, so headroom is free. It guards against state moving under the estimate.
  const gas = (request.gas * 12n) / 10n
  // A node rejects a transaction the sender cannot pay for. Checking BEFORE signing turns that into an instant,
  // named refusal. Found out afterwards, the action would sit as "prepared" until its deadline had passed.
  const needed = gas * (request.maxFeePerGas ?? request.gasPrice ?? 0n)
  const balance = await pub.getBalance({ address: wallet.account.address })
  if (balance < needed) throw new OperatorLowGasError(balance, needed)
  const serialized = signer
    ? await signer({
        chainId: request.chainId ?? (await pub.getChainId()),
        to: call.desk,
        data,
        nonce: request.nonce,
        gas,
        ...(request.maxFeePerGas === undefined
          ? { gasPrice: request.gasPrice }
          : { maxFeePerGas: request.maxFeePerGas, maxPriorityFeePerGas: request.maxPriorityFeePerGas }),
      })
    : await wallet.signTransaction({ ...request, gas })
  return {
    kind: call.kind,
    desk: call.desk,
    serialized,
    txHash: keccak256(serialized),
    nonce: request.nonce,
    calldataHash: keccak256(data),
    ...(deadlineUnix === undefined ? {} : { deadlineUnix }),
  }
}

/**
 * A contract deadline `seconds` from now. It takes the LATER of the chain clock and the local clock: the chain
 * clock alone is stale whenever the chain has been quiet, which would put the deadline in the past before the
 * transaction is even signed. A local clock that runs fast only makes the deadline a little longer.
 */
export async function deadlineIn(pub: PublicClient, seconds: number): Promise<number> {
  const block = await pub.getBlock()
  return Math.max(Number(block.timestamp), Math.floor(Date.now() / 1000)) + seconds
}

export async function broadcast(
  pub: PublicClient,
  signed: Pick<SignedDeskCall, 'serialized' | 'txHash'>,
): Promise<void> {
  const reported = await pub.sendRawTransaction({ serializedTransaction: signed.serialized })
  if (reported.toLowerCase() !== signed.txHash.toLowerCase()) {
    throw new Error(`the network reported hash ${reported}, but the saved hash is ${signed.txHash}`)
  }
}

/** A pause carries no decision hash. Its outcome says so with the zero hash and a chain seq of nothing. */
const NO_HASH: Hex = `0x${'0'.repeat(64)}`

function readReceipt(kind: DeskCall['kind'], receipt: TransactionReceipt): DeskOutcome {
  const base = {
    txHash: receipt.transactionHash,
    blockNumber: receipt.blockNumber,
    gasUsed: receipt.gasUsed,
    effectiveGasPrice: receipt.effectiveGasPrice,
  }
  if (receipt.status !== 'success') return { status: 'reverted', ...base }
  if (kind === 'pause') {
    const [log] = parseEventLogs({ abi: deskAbi, eventName: 'Paused', logs: receipt.logs })
    if (!log) throw new Error(`no Paused event in tx ${receipt.transactionHash}`)
    return { status: 'confirmed', ...base, chainSeq: 0n, eventHash: NO_HASH }
  }
  if (kind === 'buy') {
    const [log] = parseEventLogs({ abi: deskAbi, eventName: 'Bought', logs: receipt.logs })
    if (!log) throw new Error(`no Bought event in tx ${receipt.transactionHash}`)
    const { seq, tokenOut, feedPrice, decisionHash } = log.args
    return {
      status: 'confirmed',
      ...base,
      chainSeq: seq,
      eventHash: decisionHash,
      amountOut: tokenOut,
      feedPrice,
    }
  }
  if (kind === 'sell') {
    const [log] = parseEventLogs({ abi: deskAbi, eventName: 'Sold', logs: receipt.logs })
    if (!log) throw new Error(`no Sold event in tx ${receipt.transactionHash}`)
    const { seq, usdgOut, feedPrice, decisionHash } = log.args
    return {
      status: 'confirmed',
      ...base,
      chainSeq: seq,
      eventHash: decisionHash,
      amountOut: usdgOut,
      feedPrice,
    }
  }
  if (kind === 'sweep') {
    const [log] = parseEventLogs({ abi: deskAbi, eventName: 'Swept', logs: receipt.logs })
    if (!log) throw new Error(`no Swept event in tx ${receipt.transactionHash}`)
    const { seq, shares, decisionHash } = log.args
    return { status: 'confirmed', ...base, chainSeq: seq, eventHash: decisionHash, amountOut: shares }
  }
  if (kind === 'redeem') {
    const [log] = parseEventLogs({ abi: deskAbi, eventName: 'Redeemed', logs: receipt.logs })
    if (!log) throw new Error(`no Redeemed event in tx ${receipt.transactionHash}`)
    const { seq, usdgOut, decisionHash } = log.args
    return { status: 'confirmed', ...base, chainSeq: seq, eventHash: decisionHash, amountOut: usdgOut }
  }
  const [log] = parseEventLogs({ abi: deskAbi, eventName: 'Checkpoint', logs: receipt.logs })
  if (!log) throw new Error(`no Checkpoint event in tx ${receipt.transactionHash}`)
  return { status: 'confirmed', ...base, chainSeq: log.args.seq, eventHash: log.args.decisionHash }
}

export async function waitForOutcome(
  pub: PublicClient,
  sent: Pick<SignedDeskCall, 'kind' | 'txHash'>,
): Promise<DeskOutcome> {
  const receipt = await pub.waitForTransactionReceipt({ hash: sent.txHash, timeout: 180_000 })
  return readReceipt(sent.kind, receipt)
}

/** undefined means the network has no receipt for this hash right now. It does not mean it never will. */
export async function findOutcome(
  pub: PublicClient,
  sent: Pick<SignedDeskCall, 'kind' | 'txHash'>,
): Promise<DeskOutcome | undefined> {
  try {
    return readReceipt(sent.kind, await pub.getTransactionReceipt({ hash: sent.txHash }))
  } catch (e) {
    if (e instanceof TransactionReceiptNotFoundError) return undefined
    throw e
  }
}

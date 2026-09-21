/**
 * The desk's recorded calls that our worker did not send.
 *
 * Every `buy`, `sell`, `sweepToVault`, `redeemFromVault` and `checkpoint` moves the contract's `seq` forward,
 * whoever calls it. The owner may call them, and on v1 so may the owner's session key. When `seq` is ahead of
 * what the database knows, these are the calls in between, each with the address that sent it. The caller
 * decides what that means: a call from the owner or the session key is the owner's own action; a call from the
 * operator that the database has no record of is a real problem and must stop the desk.
 */
import type { Address, Hex, PublicClient } from 'viem'
import { deskAbi } from './generated/desk-abi'

export interface RecordedCall {
  seq: bigint
  event: 'Bought' | 'Sold' | 'Swept' | 'Redeemed' | 'Checkpoint'
  txHash: Hex
  blockNumber: bigint
  /** Who sent the transaction. */
  from: Address
  decisionHash: Hex
  /** The event's own fields, as decimal strings, for the record. */
  detail: Record<string, string>
}

const RECORDED = new Set(['Bought', 'Sold', 'Swept', 'Redeemed', 'Checkpoint'])

/**
 * The recorded calls with `seq` in (afterSeq, upToSeq], oldest first. Searches from `fromBlock`, which should be
 * a block at or before the first of them: the desk's last confirmed action is a good one. Events and their
 * encoding are identical in v0 and v1, so one ABI reads both.
 */
export async function recordedCallsBetween(
  pub: PublicClient,
  desk: Address,
  afterSeq: bigint,
  upToSeq: bigint,
  fromBlock: bigint,
): Promise<RecordedCall[]> {
  const logs = await pub.getContractEvents({ address: desk, abi: deskAbi, fromBlock, toBlock: 'latest' })
  const wanted = logs.filter((l) => {
    if (!RECORDED.has(l.eventName)) return false
    const seq = (l.args as { seq?: bigint }).seq
    return seq !== undefined && seq > afterSeq && seq <= upToSeq
  })
  const senders = new Map<Hex, Address>()
  for (const l of wanted) {
    if (!senders.has(l.transactionHash)) {
      const tx = await pub.getTransaction({ hash: l.transactionHash })
      senders.set(l.transactionHash, tx.from)
    }
  }
  return wanted
    .map((l) => {
      const args = l.args as Record<string, unknown> & { seq: bigint; decisionHash: Hex }
      const detail: Record<string, string> = {}
      for (const [k, v] of Object.entries(args)) {
        if (k !== 'seq' && k !== 'decisionHash') detail[k] = String(v)
      }
      return {
        seq: args.seq,
        event: l.eventName as RecordedCall['event'],
        txHash: l.transactionHash,
        blockNumber: l.blockNumber,
        from: senders.get(l.transactionHash) as Address,
        decisionHash: args.decisionHash,
        detail,
      }
    })
    .sort((a, b) => (a.seq < b.seq ? -1 : 1))
}

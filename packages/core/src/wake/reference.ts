/**
 * Where the close reference comes from. The engine asks through this one function, so a replay of a past
 * weekend can hand it history instead of the live chain.
 *
 * Computing a reference means a binary search for the boundary block and a scan of swap logs: seconds of work.
 * It is a fact that never changes, so it is computed once per token per close and then read from the database.
 */
import { type ApprovedToken, type BlockMark, blockAtOrBefore, readCloseReference } from '@desk/chain'
import { type Db, findReference, saveReference } from '@desk/db'
import { nyTime } from '@desk/shared'
import type { PublicClient } from 'viem'

export interface Reference {
  priceE8: bigint
  boundaryAt: Date
  multiplierRaw: bigint
}
export type ReferenceSource = (
  token: ApprovedToken,
  boundaryAt: Date,
  /** `close` is what the pool traded at when the market shut. `open` is the price a grade compares against. */
  kind?: 'close' | 'open',
) => Promise<Reference | undefined>

export function chainReferenceSource(db: Db, pub: PublicClient): ReferenceSource {
  const boundaryBlocks = new Map<number, Promise<BlockMark>>()
  return async (token, boundaryAt, kind = 'close') => {
    const sessionDate = nyTime(boundaryAt).date
    const saved = await findReference(db, token.address, kind, sessionDate)
    if (saved)
      return { priceE8: saved.priceE8, boundaryAt: saved.boundaryAt, multiplierRaw: saved.multiplierRaw }

    const key = boundaryAt.getTime()
    let mark = boundaryBlocks.get(key)
    if (!mark) {
      mark = blockAtOrBefore(pub, boundaryAt)
      boundaryBlocks.set(key, mark)
    }
    const found = await readCloseReference(pub, token, boundaryAt, await mark)
    if (!found) return undefined
    await saveReference(db, {
      token: token.address,
      kind,
      sessionDate,
      boundaryAt,
      priceE8: found.priceE8,
      multiplierRaw: found.multiplierRaw,
      txHash: found.txHash,
      blockNumber: Number(found.blockNumber),
    })
    return { priceE8: found.priceE8, boundaryAt, multiplierRaw: found.multiplierRaw }
  }
}

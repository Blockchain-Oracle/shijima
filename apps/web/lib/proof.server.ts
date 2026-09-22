/**
 * What "Check it" needs to compare a record with the public network, read on the server from Postgres.
 *
 * A record with its own transaction is the easy case: the event carries its fingerprint. A record that did
 * nothing has no transaction, so it is sealed by a LATER record whose fingerprint commits to it through the
 * chain of `prevHash` values. The browser walks that chain itself, so the page ships the bodies in between.
 * A record nobody has sealed yet says so, with when the next seal is due.
 */
import { lastSealAt, recordsBetween, sealingRecordFor } from '@desk/db'
import { db } from './db'

/** How often the worker seals the record with a checkpoint. Kept in step with the worker's own constant. */
const SEAL_EVERY_MS = 24 * 60 * 60 * 1000

export type Proof =
  | { kind: 'own'; txHash: string }
  | { kind: 'later'; txHash: string; sealingSeq: number; links: { seq: number; record: unknown }[] }
  | { kind: 'unknown'; txHash: string }
  | { kind: 'unsealed'; nextSealAt: string | null }

export async function proofFor(
  deskId: string,
  decision: { seq: number; sealedByTx: string | null },
  legs: { status: string; txHash: string | null }[],
): Promise<Proof> {
  const own = legs.find((l) => l.status === 'confirmed' && l.txHash)
  if (own?.txHash) return { kind: 'own', txHash: own.txHash }
  if (decision.sealedByTx) {
    const sealing = await sealingRecordFor(db(), deskId, decision.sealedByTx)
    if (!sealing || sealing.seq <= decision.seq) return { kind: 'unknown', txHash: decision.sealedByTx }
    const links = await recordsBetween(db(), deskId, decision.seq, sealing.seq)
    return {
      kind: 'later',
      txHash: decision.sealedByTx,
      sealingSeq: sealing.seq,
      links: links.map((l) => ({ seq: l.seq, record: l.record })),
    }
  }
  const sealedAt = await lastSealAt(db(), deskId)
  return {
    kind: 'unsealed',
    nextSealAt: sealedAt ? new Date(sealedAt.getTime() + SEAL_EVERY_MS).toISOString() : null,
  }
}

import { APPROVED_TOKENS } from '@desk/chain'
import { deskCopy, usd } from '@desk/shared'
import type { DeskView } from '@/lib/desk.server'

/**
 * The record's notes in words: what changed a desk without a decision of its own [8.16]. Money that moved
 * outside the desk, the owner's own calls, and a multiplier change that moved a holding's value with no trade.
 */
export type DeskNote = DeskView['notes'][number]

const n = deskCopy.record.notes
const nameOf = (address: unknown) =>
  typeof address === 'string'
    ? (APPROVED_TOKENS.find((t) => t.address.toLowerCase() === address.toLowerCase())?.displayName ?? null)
    : null

export function noteLabel(note: DeskNote): string {
  return note.kind === 'owner_action'
    ? n.ownerLabel
    : note.kind === 'multiplier'
      ? n.multiplierLabel
      : n.outsideLabel
}

export function noteText(note: DeskNote): string {
  const d = note.detail as Record<string, unknown>
  if (note.kind === 'multiplier') {
    const oldRaw = BigInt(String(d.oldRaw ?? '0'))
    const newRaw = BigInt(String(d.newRaw ?? '0'))
    // Millionths of the old multiplier, then percent: 1.000775 over 1.0 is 775 millionths, 0.0775%.
    const percent = oldRaw > 0n ? Number(((newRaw - oldRaw) * 1_000_000n) / oldRaw) / 10_000 : 0
    return n.multiplier(nameOf(d.token) ?? 'A holding', `${percent.toFixed(percent < 1 ? 3 : 2)}%`)
  }
  if (note.kind === 'owner_action') {
    const verb = n.calls[String(d.event)] ?? n.call
    const token = nameOf((d.detail as Record<string, unknown> | undefined)?.token)
    return n.owner(token ? `${verb} ${token}` : verb)
  }
  const changes =
    (d.changes as { asset: string; delta: string; usdgValue: string | null }[] | undefined) ?? []
  const parts = changes.map((c) => {
    const delta = BigInt(c.delta)
    const value = c.usdgValue === null ? null : BigInt(c.usdgValue)
    const size = value === null ? '' : usd(value < 0n ? -value : value)
    const what = c.asset === 'USDG' ? size : `${nameOf(c.asset) ?? c.asset}${size ? ` worth ${size}` : ''}`
    return delta > 0n ? n.added(what) : n.removed(what)
  })
  return n.outside(parts.join(', '))
}

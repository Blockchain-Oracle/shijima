/**
 * Who may write in a Room or post a take: a signed-in wallet that owns a desk on the chain. Checked here, on the
 * server, for every request. A gate that lives only in the page is not a gate.
 */
import { socialMember, writtenSince } from '@desk/db'
import { db } from '@/lib/db'
import { signedInAddress } from '@/lib/session'

export type Member =
  | { kind: 'signed_out' }
  | { kind: 'no_desk'; address: string }
  | { kind: 'member'; address: string; ownerId: string }

export async function currentMember(): Promise<Member> {
  const address = await signedInAddress()
  if (!address) return { kind: 'signed_out' }
  const found = await socialMember(db(), address)
  return found?.ownsDesk ? { kind: 'member', address, ownerId: found.ownerId } : { kind: 'no_desk', address }
}

/**
 * Limits counted in Postgres, so they hold across restarts and instances. Agari's numbers: a Room line every
 * 3 seconds and 20 in 10 minutes; 3 takes a minute and 30 a day.
 */
const LIMITS = {
  room: [
    { max: 1, ms: 3_000 },
    { max: 20, ms: 10 * 60_000 },
  ],
  takes: [
    { max: 3, ms: 60_000 },
    { max: 30, ms: 24 * 60 * 60_000 },
  ],
} as const

export async function withinLimits(table: 'room' | 'takes', ownerId: string): Promise<boolean> {
  const now = Date.now()
  for (const limit of LIMITS[table]) {
    if ((await writtenSince(db(), table, ownerId, new Date(now - limit.ms))) >= limit.max) return false
  }
  return true
}

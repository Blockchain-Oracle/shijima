'use server'

import { askHistory } from '@desk/db'
import type { ChatTurn } from '@/features/desk/chat-model'
import { toChatTurn } from '@/features/desk/chat-model'
import { db } from '@/lib/db'
import { loadDesk } from '@/lib/desk.server'
import { signedInAddress } from '@/lib/session'

/**
 * The chat for the Ask drawer, which opens on any page: one agent's conversation so far, for its own owner only.
 * A visitor, or an agent that is not theirs, gets nothing.
 */
export async function askTurnsAction(
  slug?: string,
): Promise<{ deskId?: string; slug?: string; name: string; turns: ChatTurn[] } | null> {
  if (!slug) {
    const owner = await signedInAddress()
    if (!owner) return null
    const rows = await askHistory(db(), null, owner)
    return { name: 'Explore Shijima', turns: rows.map((row) => toChatTurn(row, null)) }
  }
  const view = await loadDesk(slug).catch(() => undefined)
  if (!view?.isOwner) return null
  return { deskId: view.desk.id, slug: view.slug, name: view.desk.name, turns: view.turns }
}

'use server'

import type { ChatTurn } from '@/features/desk/chat-model'
import { loadDesk } from '@/lib/desk.server'

/**
 * The chat for the Ask drawer, which opens on any page: one agent's conversation so far, for its own owner only.
 * A visitor, or an agent that is not theirs, gets nothing.
 */
export async function askTurnsAction(
  slug: string,
): Promise<{ deskId: string; slug: string; name: string; turns: ChatTurn[] } | null> {
  const view = await loadDesk(slug).catch(() => undefined)
  if (!view?.isOwner) return null
  return { deskId: view.desk.id, slug: view.slug, name: view.desk.name, turns: view.turns }
}

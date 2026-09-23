/**
 * Pictures in Telegram: after a trade and with the report, the desk's share card, drawn by the web app's own
 * Open Graph route (`/agents/[slug]/opengraph-image`) and sent as a photo under the text.
 *
 * A picture is decoration. The words have already gone when one is queued, so a failed fetch or a failed upload
 * costs nothing but the picture. They go out one at a time in the background, never inside the outbox's pass,
 * so no request for approval ever waits behind an image.
 */
import { errorText } from '@desk/shared'
import { type Bot, InputFile } from 'grammy'
import type { Log } from '../review'

/** A card that takes longer than this to draw is skipped. */
const FETCH_TIMEOUT_MS = 8_000
/** Past this many waiting pictures, new ones are dropped rather than let the queue grow without end. */
const MAX_WAITING = 20

export interface CardSender {
  /** Queues the card for a shared desk, as a reply to the message it illustrates. Never throws, never waits. */
  send: (chatId: number, shareSlug: string, replyTo?: number) => void
  /** Waits for the pictures already queued. Used on shutdown. */
  idle: () => Promise<void>
}

/** The card's address. Only a shared desk has one: the route draws nothing private. */
export const cardUrl = (webUrl: string, shareSlug: string) =>
  `${webUrl.replace(/\/$/, '')}/agents/${encodeURIComponent(shareSlug)}/opengraph-image`

export async function fetchCard(url: string): Promise<Uint8Array> {
  const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), redirect: 'follow' })
  if (!res.ok) throw new Error(`the card route answered ${res.status}`)
  const type = res.headers.get('content-type') ?? ''
  if (!type.startsWith('image/'))
    throw new Error(`the card route sent ${type || 'no content type'}, not an image`)
  return new Uint8Array(await res.arrayBuffer())
}

export function createCardSender(bot: Bot, webUrl: string, log: Log): CardSender {
  let chain: Promise<void> = Promise.resolve()
  let waiting = 0
  return {
    send: (chatId, shareSlug, replyTo) => {
      if (waiting >= MAX_WAITING) {
        log('telegram_card_dropped', { chat: chatId, note: 'too many pictures waiting' })
        return
      }
      waiting++
      const url = cardUrl(webUrl, shareSlug)
      chain = chain
        .then(async () => {
          const png = await fetchCard(url)
          await bot.api.sendPhoto(chatId, new InputFile(png, 'shijima-card.png'), {
            disable_notification: true,
            ...(replyTo
              ? { reply_parameters: { message_id: replyTo, allow_sending_without_reply: true } }
              : {}),
          })
          log('telegram_card_sent', { chat: chatId, url })
        })
        .catch((e) => log('telegram_card_failed', { chat: chatId, url, error: errorText(e) }))
        .finally(() => {
          waiting--
        })
    },
    idle: () => chain,
  }
}

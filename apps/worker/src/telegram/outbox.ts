/**
 * Sends what the engine wrote down, and keeps the pinned status message true.
 *
 * The engine never talks to Telegram itself. It writes a row in the same transaction as the thing it is
 * announcing, and this drains those rows. So a message can never claim something that was not committed, and
 * a Telegram outage can never roll back a decision: a send that fails is tried again later, and only after
 * several attempts is it given up on.
 *
 * The pinned message is EDITED, never re-sent. That is what keeps an hourly desk from becoming 160
 * notifications a week, which is how an owner ends up muting the thing meant to watch their money.
 */
import {
  approvalById,
  approvalMessageId,
  type Db,
  deskById,
  linkForDesk,
  markNotificationSent,
  pendingNotifications,
  postponeNotification,
  setStatusMessageId,
} from '@desk/db'
import { errorText, telegramCopy } from '@desk/shared'
import { type Bot, InlineKeyboard } from 'grammy'
import type { Log } from '../review'
import { approvalKeyboard, deskPath } from './bot'
import { buildStatus, nyClock } from './status'

export interface OutboxDeps {
  db: Db
  bot: Bot
  log: Log
  siteUrl: string
}

type Payload = Record<string, unknown>
const text = (p: Payload, key: string, fallback = ''): string =>
  typeof p[key] === 'string' ? (p[key] as string) : fallback

/** Sends every message that is waiting. A desk with no linked chat has its messages marked skipped, not lost. */
export async function drainOutbox(deps: OutboxDeps): Promise<number> {
  const { db, bot, log } = deps
  let sent = 0
  for (const row of await pendingNotifications(db)) {
    try {
      const link = await linkForDesk(db, row.deskId)
      if (!link?.telegramChatId) {
        await markNotificationSent(db, row.id, { status: 'skipped', error: 'no Telegram chat is linked' })
        continue
      }
      const chatId = link.telegramChatId
      const payload = (row.payload ?? {}) as Payload
      const what = text(payload, 'what', text(payload, 'summary'))
      const why = text(payload, 'summary')

      if (row.kind === 'status') {
        const shown = await updateStatus(deps, row.deskId, chatId, link.id, link.statusMessageId)
        await markNotificationSent(db, row.id, {
          status: shown ? 'sent' : 'skipped',
          ...(shown ? {} : { error: 'the desk has not checked yet' }),
        })
        if (shown) sent++
        continue
      }

      // A request answered somewhere else, or lapsed: the message that asked is edited, never a new one sent.
      if (row.kind === 'approval_answered') {
        const edited = await editAnsweredRequest(deps, row.deskId, row.decisionId, payload)
        await markNotificationSent(db, row.id, {
          status: edited ? 'sent' : 'skipped',
          ...(edited ? {} : { error: 'no request message to edit' }),
        })
        if (edited) sent++
        continue
      }

      const desk = await deskById(db, row.deskId)
      const body =
        row.kind === 'approval_request' || row.kind === 'large_action_request'
          ? telegramCopy.approvalRequest({
              large: row.kind === 'large_action_request',
              what,
              why,
              turnedDown: typeof payload.turnedDown === 'string' ? payload.turnedDown : undefined,
              confidence: text(payload, 'confidence', 'not stated'),
              expires: expiresText(text(payload, 'expiresAt')),
            })
          : row.kind === 'acted'
            ? telegramCopy.acted(what, why)
            : row.kind === 'would_have'
              ? telegramCopy.wouldHave(what, why)
              : row.kind === 'not_acted'
                ? telegramCopy.notActed(what, why)
                : row.kind === 'monday_report'
                  ? telegramCopy.mondayReport(
                      text(payload, 'text'),
                      `${deps.siteUrl}${text(payload, 'path')}`,
                    )
                  : telegramCopy.alert(text(payload, 'text', why))

      const keyboard =
        (row.kind === 'approval_request' || row.kind === 'large_action_request') &&
        typeof payload.approvalId === 'string' &&
        desk
          ? approvalKeyboard(
              payload.approvalId,
              deps.siteUrl,
              deskPath(desk),
              Number(payload.decisionSeq ?? 0),
            )
          : undefined

      const message = await bot.api.sendMessage(chatId, body, {
        parse_mode: 'HTML',
        ...(keyboard ? { reply_markup: keyboard } : {}),
      })
      await markNotificationSent(db, row.id, { status: 'sent', messageId: message.message_id })
      sent++
    } catch (e) {
      const error = errorText(e)
      // Tried again later, with a longer wait each time. Failed for good only after the last attempt.
      const outcome = await postponeNotification(db, row.id, error)
      log('telegram_send_failed', { id: row.id, kind: row.kind, error, ...outcome })
    }
  }
  return sent
}

/** "05:00 New York time", from the request's expiry, or "the next check" when it has none. */
function expiresText(iso: string): string {
  if (!iso) return 'the next check'
  const at = new Date(iso)
  return Number.isNaN(at.getTime()) ? 'the next check' : `${nyClock(at)} ${telegramCopy.timesAreNewYork}`
}

/**
 * The one pinned message. Sent once, pinned silently, then edited for ever. Telegram answers "message is not
 * modified" when nothing changed, which is not a failure and is ignored.
 */
async function updateStatus(
  deps: OutboxDeps,
  deskId: string,
  chatId: number,
  linkId: string,
  messageId: number | null,
): Promise<boolean> {
  const { bot, db } = deps
  const status = await buildStatus(db, deskId)
  if (!status) return false
  const body = telegramCopy.status(status)
  // A ↻ under the pinned message, so the owner can bring it up to date without typing /status.
  const reply_markup = new InlineKeyboard().text(telegramCopy.menu.refresh, 'menu:refresh')

  if (messageId) {
    try {
      await bot.api.editMessageText(chatId, messageId, body, { parse_mode: 'HTML', reply_markup })
      return true
    } catch (e) {
      if (errorText(e).includes('message is not modified')) return true
      // The message was deleted, or is too old to change. Send a fresh one and pin that instead.
      deps.log('telegram_status_resend', { desk: deskId, why: errorText(e) })
    }
  }
  const message = await bot.api.sendMessage(chatId, body, {
    parse_mode: 'HTML',
    disable_notification: true,
    reply_markup,
  })
  await bot.api
    .pinChatMessage(chatId, message.message_id, { disable_notification: true })
    .catch(() => undefined)
  await setStatusMessageId(db, linkId, message.message_id)
  return true
}

/** Puts the pinned message up, or brings it up to date. Used on linking and by /status. */
export async function refreshStatus(deps: OutboxDeps, deskId: string): Promise<boolean> {
  const link = await linkForDesk(deps.db, deskId)
  if (!link?.telegramChatId) return false
  return updateStatus(deps, deskId, link.telegramChatId, link.id, link.statusMessageId)
}

/** An `approval_answered` row, turned into the edit of the message that asked. */
async function editAnsweredRequest(
  deps: OutboxDeps,
  deskId: string,
  decisionId: string | null,
  payload: Payload,
): Promise<boolean> {
  if (!decisionId) return false
  const answer = text(payload, 'answer')
  if (answer !== 'approved' && answer !== 'rejected' && answer !== 'expired' && answer !== 'cancelled')
    return false
  const found =
    typeof payload.approvalId === 'string' ? await approvalById(deps.db, payload.approvalId) : undefined
  const via = text(payload, 'via')
  const where = via === 'web' || via === 'chat' ? telegramCopy.answeredWhere[via] : undefined
  return updateAnsweredMessage(deps, {
    deskId,
    decisionId,
    answer,
    what: found?.decision.summary ?? '',
    ...(where ? { where } : {}),
  })
}

/**
 * Keeps a request's message honest when it was answered somewhere else, or simply ran out of time.
 *
 * Without this the owner would be left looking at live Approve and Reject buttons for something already
 * decided on the website, and pressing one would fail for reasons they could not see.
 */
export async function updateAnsweredMessage(
  deps: OutboxDeps,
  input: {
    deskId: string
    decisionId: string
    answer: 'approved' | 'rejected' | 'expired' | 'cancelled'
    what: string
    where?: string
  },
): Promise<boolean> {
  const messageId = await approvalMessageId(deps.db, input.decisionId)
  const link = await linkForDesk(deps.db, input.deskId)
  if (!messageId || !link?.telegramChatId) return false
  try {
    await deps.bot.api.editMessageText(
      link.telegramChatId,
      messageId,
      telegramCopy.approvalAnswered(input.answer, input.what, input.where),
      { parse_mode: 'HTML' },
    )
    return true
  } catch (e) {
    // Already edited, or too old to change. The record is the truth either way.
    if (!errorText(e).includes('message is not modified')) {
      deps.log('telegram_edit_failed', { decision: input.decisionId, error: errorText(e) })
    }
    return true
  }
}

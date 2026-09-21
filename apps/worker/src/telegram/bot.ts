/**
 * The desk's voice: our own Telegram bot.
 *
 * Ours and not the platform's, because OpenServ's own Telegram integration cannot send a message, edit one,
 * or receive a button press, and all three are the point. An approval that cannot be answered where the owner
 * already is would not be answered at all.
 *
 * Two rules run through everything here. A chat only ever hears about the ONE desk it was linked to, checked
 * on the Telegram user id at every turn, so a forwarded message or a guessed id gets nothing. And answering
 * a request never moves money: it flips a row, and the worker re-reads the price on its next check.
 */
import {
  answerApproval,
  approvalById,
  claimTelegramLink,
  type Db,
  deskForTelegramUser,
  pauseDesk,
  resumeDesk,
} from '@desk/db'
import { errorText, telegramCopy } from '@desk/shared'
import { Bot, InlineKeyboard } from 'grammy'
import type { Log } from '../review'

const CODE = /^[A-Za-z0-9]{6,12}$/

export interface TelegramDeps {
  db: Db
  log: Log
  /** Where the decision pages live, for the "see the full decision" button. */
  siteUrl: string
}

export function createBot(token: string, deps: TelegramDeps): Bot {
  const bot = new Bot(token)
  const { db, log } = deps

  // Private chats only. A desk in a group would announce one person's money to a room.
  bot.use(async (ctx, next) => {
    if (ctx.chat && ctx.chat.type !== 'private') return
    await next()
  })

  /** The desk this Telegram user may hear about, or nothing. Every handler starts here. */
  const deskOf = async (userId: number | undefined) =>
    userId === undefined ? undefined : await deskForTelegramUser(db, userId)

  bot.command('start', async (ctx) => {
    const payload = ctx.match?.trim()
    const linked = await deskOf(ctx.from?.id)
    if (linked)
      return ctx.reply(telegramCopy.firstContact(linked.desk.name ?? 'your desk'), { parse_mode: 'HTML' })
    if (payload && CODE.test(payload)) return void (await link(ctx, payload))
    return ctx.reply(telegramCopy.notLinked)
  })

  bot.command('help', (ctx) => ctx.reply(telegramCopy.help, { parse_mode: 'HTML' }))

  bot.command('status', async (ctx) => {
    const linked = await deskOf(ctx.from?.id)
    if (!linked) return ctx.reply(telegramCopy.notLinked)
    // The pinned message already holds the answer, so point at it rather than send a second copy.
    if (linked.link.statusMessageId) {
      return ctx.reply('It is in the pinned message above, kept up to date at every check.')
    }
    return ctx.reply('It has not checked yet. The pinned message appears after the first check.')
  })

  for (const [command, run] of [
    ['pause', pauseDesk],
    ['resume', resumeDesk],
  ] as const) {
    bot.command(command, async (ctx) => {
      const linked = await deskOf(ctx.from?.id)
      if (!linked) return ctx.reply(telegramCopy.notLinked)
      const done = await run(db, linked.desk.id, { actor: 'owner', via: 'telegram' })
      log('telegram_command', { command, desk: linked.desk.address, done })
      return ctx.reply(
        done
          ? command === 'pause'
            ? telegramCopy.paused
            : telegramCopy.resumed
          : telegramCopy.alreadyInThatState,
      )
    })
  }

  // The buttons on a request. The callback data carries the approval id and nothing else.
  bot.callbackQuery(/^(approve|reject):(.+)$/, async (ctx) => {
    const [, choice, approvalId] = ctx.match as unknown as [string, string, string]
    const linked = await deskOf(ctx.from?.id)
    if (!linked) return ctx.answerCallbackQuery({ text: telegramCopy.notLinked, show_alert: true })
    const found = await approvalById(db, approvalId)
    // The request must belong to THIS user's desk. A button press proves nothing on its own.
    if (!found || found.approval.deskId !== linked.desk.id) {
      return ctx.answerCallbackQuery({ text: telegramCopy.notYourDesk, show_alert: true })
    }

    const answer = choice === 'approve' ? 'approved' : 'rejected'
    const row = await answerApproval(db, {
      approvalId,
      answer,
      ownerId: linked.desk.ownerId,
      via: 'telegram',
    })
    log('telegram_answer', { desk: linked.desk.address, approvalId, answer, accepted: Boolean(row) })
    if (!row) {
      await ctx.answerCallbackQuery({ text: telegramCopy.linkUsed, show_alert: true })
      return void (await ctx.editMessageText(
        telegramCopy.approvalAnswered('expired', found.decision.summary),
        { parse_mode: 'HTML' },
      ))
    }
    await ctx.answerCallbackQuery({ text: answer === 'approved' ? 'Approved' : 'Rejected' })
    await ctx.editMessageText(telegramCopy.approvalAnswered(answer, found.decision.summary, 'buttons here'), {
      parse_mode: 'HTML',
    })
  })

  // A bare code pasted into the chat, for owners who copy it rather than follow the link.
  bot.on('message:text', async (ctx) => {
    const text = ctx.message.text.trim()
    if (await deskOf(ctx.from.id)) return ctx.reply(telegramCopy.help, { parse_mode: 'HTML' })
    if (CODE.test(text)) return void (await link(ctx, text))
    return ctx.reply(telegramCopy.notLinked)
  })

  bot.catch((e) => log('telegram_error', { error: errorText(e.error) }))

  async function link(
    ctx: {
      from?: { id: number; username?: string | undefined } | undefined
      chat?: { id: number } | undefined
      reply: (text: string, other?: { parse_mode?: 'HTML' }) => Promise<unknown>
    },
    code: string,
  ) {
    const from = ctx.from
    const chatId = ctx.chat?.id
    if (!from || chatId === undefined) return
    const row = await claimTelegramLink(db, code, {
      userId: from.id,
      chatId,
      username: from.username ?? undefined,
    })
    if (!row) return void (await ctx.reply(telegramCopy.linkUsed))
    const linked = await deskOf(from.id)
    log('telegram_linked', { desk: linked?.desk.address, user: from.id })
    await ctx.reply(telegramCopy.firstContact(linked?.desk.name ?? 'your desk'), { parse_mode: 'HTML' })
  }

  return bot
}

/** The buttons under a request. "See the full decision" is a plain link, so it works with no session. */
export function approvalKeyboard(approvalId: string, siteUrl: string, slug: string | null, seq: number) {
  const keyboard = new InlineKeyboard()
    .text('Approve', `approve:${approvalId}`)
    .text('Reject', `reject:${approvalId}`)
  if (slug) keyboard.row().url(telegramCopy.seeDetails, `${siteUrl}/desk/${slug}/decision/${seq}`)
  return keyboard
}

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
import { APPROVED_TOKENS } from '@desk/chain'
import { type AskAnswer, confirmSigninProposal } from '@desk/core'
import {
  answerApproval,
  approvalById,
  askAllowed,
  askRequestForOwner,
  claimTelegramLink,
  createAskRequest,
  type Db,
  deskById,
  deskForTelegramUser,
  pauseDesk,
  resumeDesk,
} from '@desk/db'
import { errorText, telegramCopy } from '@desk/shared'
import { Bot, InlineKeyboard } from 'grammy'
import type { Log } from '../review'

/** How long a Telegram message waits for the desk's answer before saying it is still thinking. */
const ASK_WAIT_MS = 45_000

const CODE = /^[A-Za-z0-9]{6,12}$/

export interface TelegramDeps {
  db: Db
  log: Log
  /** Where the decision pages live, for the "see the full decision" button. */
  siteUrl: string
  /** Puts the pinned message up, or brings it up to date. Returns false if the desk has never checked. */
  refreshStatus: (deskId: string) => Promise<boolean>
  /** Wakes the chat's loop, so a message is answered at once rather than at the next sweep. */
  kickAsk?: () => void
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
    // Bring the pinned message up to date and point at it, rather than send a second copy that then goes stale.
    const shown = await deps.refreshStatus(linked.desk.id)
    return ctx.reply(
      shown ? 'It is in the pinned message, brought up to date just now.' : telegramCopy.notCheckedYet,
    )
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

  // The buttons under a chat card. The callback data carries the proposal id and nothing else.
  bot.callbackQuery(/^ask:(ok|no):(.+)$/, async (ctx) => {
    const [, choice, proposalId] = ctx.match as unknown as [string, string, string]
    const linked = await deskOf(ctx.from?.id)
    if (!linked) return ctx.answerCallbackQuery({ text: telegramCopy.notLinked, show_alert: true })
    const desk = await deskById(db, linked.desk.id)
    if (!desk) return ctx.answerCallbackQuery({ text: telegramCopy.notLinked, show_alert: true })
    if (choice === 'no') {
      await ctx.answerCallbackQuery({ text: telegramCopy.leftAlone })
      return void (await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } }))
    }
    // The proposal is taken only if it belongs to this desk's owner, is open, and has not expired.
    const outcome = await confirmSigninProposal(db, APPROVED_TOKENS, {
      proposalId,
      ownerAddress: desk.ownerAddress,
      via: 'telegram',
    })
    log('telegram_confirm', { desk: desk.address, proposalId, ok: outcome.ok })
    await ctx.answerCallbackQuery({ text: outcome.ok ? 'Done' : 'Not done' })
    await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } })
    return ctx.reply(outcome.text)
  })

  // Free text is a message to the desk, answered by the same chat as the website. A bare code from an owner not
  // yet linked still links, for owners who copy it rather than follow the link.
  bot.on('message:text', async (ctx) => {
    const text = ctx.message.text.trim()
    const linked = await deskOf(ctx.from.id)
    if (!linked) {
      if (CODE.test(text)) return void (await link(ctx, text))
      return ctx.reply(telegramCopy.notLinked)
    }
    const desk = await deskById(db, linked.desk.id)
    if (!desk) return ctx.reply(telegramCopy.notLinked)
    const allowed = await askAllowed(db, desk.ownerAddress)
    if (!allowed.ok) return ctx.reply(telegramCopy.askSlowDown[allowed.reason])

    const id = await createAskRequest(db, {
      ownerAddress: desk.ownerAddress,
      deskId: desk.id,
      kind: 'ask',
      via: 'telegram',
      question: text.slice(0, 1000),
    })
    deps.kickAsk?.()
    await ctx.replyWithChatAction('typing')
    const deadline = Date.now() + ASK_WAIT_MS
    let typingAt = Date.now()
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 500))
      const row = await askRequestForOwner(db, id, desk.ownerAddress)
      if (row?.status === 'failed') return ctx.reply(row.error ?? telegramCopy.askFailed)
      if (row?.status === 'answered' && row.reply) {
        const answer = row.reply as unknown as AskAnswer
        const body =
          answer.refused && answer.refused !== answer.reply
            ? `${answer.reply}\n\n${answer.refused}`
            : answer.reply
        const proposal = row.proposal
        if (proposal?.status !== 'open') return ctx.reply(body)
        const card = proposal.deskView.card as { title?: string; after?: string[]; note?: string } | undefined
        const cardText = [card?.title, ...(card?.after ?? []), card?.note].filter(Boolean).join('\n')
        if (proposal.path === 'signin') {
          return ctx.reply(`${body}\n\n${cardText}`, {
            reply_markup: new InlineKeyboard()
              .text(telegramCopy.confirm, `ask:ok:${proposal.id}`)
              .text(telegramCopy.notNow, `ask:no:${proposal.id}`),
          })
        }
        const slug = desk.shareSlug ?? desk.id
        return ctx.reply(`${body}\n\n${cardText}\n\n${telegramCopy.confirmOnSiteNote}`, {
          reply_markup: new InlineKeyboard().url(
            telegramCopy.confirmOnSite,
            `${deps.siteUrl}/desk/${slug}?proposal=${proposal.id}`,
          ),
        })
      }
      // Telegram shows "typing" for five seconds at a time.
      if (Date.now() - typingAt > 4_500) {
        typingAt = Date.now()
        await ctx.replyWithChatAction('typing').catch(() => undefined)
      }
    }
    return ctx.reply(telegramCopy.askStillThinking)
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
    // Pin the status straight away. A desk that has been checking for hours should not greet its owner with
    // "it has not checked yet" and then say nothing until the next hour turns.
    if (linked) await deps.refreshStatus(linked.desk.id)
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

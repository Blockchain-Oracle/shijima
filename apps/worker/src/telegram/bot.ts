/**
 * The desk's voice: our own Telegram bot.
 *
 * Ours and not the platform's, because OpenServ's own Telegram integration cannot send a message, edit one,
 * or receive a button press, and all three are the point. An approval that cannot be answered where the owner
 * already is would not be answered at all.
 *
 * Two rules run through everything here. A chat speaks for ONE wallet (DECISIONS F6: Telegram is linked to the
 * owner, before or after any desk exists) and only hears about that wallet's desks, checked on the Telegram
 * user id at every turn, so a forwarded message or a guessed id gets nothing. With several desks, the commands
 * act on the one the chat picked with /agents. And answering
 * a request never moves money: it flips a row, and the worker re-reads the price on its next check.
 *
 * Nothing here waits on the model. A message to the desk is acknowledged at once and answered by the chat's
 * own loop when it is ready, so /pause is never held behind someone else's question.
 */
import { resolve } from 'node:path'
import { APPROVED_TOKENS } from '@desk/chain'
import { type AskAnswer, confirmSigninProposal } from '@desk/core'
import {
  answerApproval,
  approvalById,
  askAllowed,
  askRequestForOwner,
  chatLinkedToOwner,
  claimTelegramLink,
  claimTelegramOwnerLink,
  createAskRequest,
  type Db,
  deskById,
  deskForTelegramUser,
  deskRecord,
  desksForTelegramUser,
  pauseDesk,
  resumeDesk,
  setTelegramCurrentDesk,
  telegramOwnerForUser,
} from '@desk/db'
import { ago, errorText, marketsCopy, telegramCopy } from '@desk/shared'
import { Bot, InlineKeyboard, InputFile } from 'grammy'
import type { Log } from '../review'
import { ASSETS } from './profile'
import { buildStatus } from './status'

const CODE = /^[A-Za-z0-9]{6,12}$/
const KNOWN_COMMANDS = new Set([
  '/start',
  '/help',
  '/status',
  '/pause',
  '/resume',
  '/portfolio',
  '/record',
  '/ask',
  '/agents',
])

/** Telegram refuses link buttons to anything but a public https address, so before deploy links go in the text. */
export const canLinkButton = (url: string) => url.startsWith('https://')

const MENU = /^menu:(home|portfolio|record|pause|resume|ask|refresh|agents)$/
type MenuView = 'home' | 'portfolio' | 'record' | 'ask'

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

/** The desk page a link may open: the share link when sharing is on, else the owner's own signed-in page. */
export const deskPath = (desk: { id: string; shareSlug: string | null; shareEnabled: boolean }) =>
  desk.shareEnabled && desk.shareSlug ? desk.shareSlug : desk.id

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

  /** Linked to a wallet that has no agent yet: say so, rather than the stranger's welcome. */
  const walletOnly = async (userId: number | undefined) =>
    userId === undefined ? false : Boolean(await telegramOwnerForUser(db, userId))

  const noAgentYet = (ctx: { reply: (text: string, other?: object) => Promise<unknown> }) =>
    ctx.reply(
      telegramCopy.noAgentYet,
      canLinkButton(deps.siteUrl)
        ? { reply_markup: new InlineKeyboard().url(telegramCopy.createButton, `${deps.siteUrl}/agents/new`) }
        : {},
    )

  /** The reply for a chat with no desk to act on: a linked wallet with no agent yet, or a stranger. */
  const unlinked = async (ctx: Parameters<typeof welcome>[0] & { from?: { id: number } | undefined }) =>
    (await walletOnly(ctx.from?.id)) ? noAgentYet(ctx) : welcome(ctx)

  bot.command('start', async (ctx) => {
    const payload = ctx.match?.trim()
    const linked = await deskOf(ctx.from?.id)
    if (linked) return ctx.reply(...(await menuMessage(linked.desk.id, 'home', ctx.from?.id)))
    if (payload && CODE.test(payload)) return void (await link(ctx, payload))
    return unlinked(ctx)
  })

  bot.command('agents', async (ctx) => {
    const linked = await deskOf(ctx.from?.id)
    if (!linked) return unlinked(ctx)
    // A chat linked the old way, per agent, has one agent and no switch: show it.
    if (!(await telegramOwnerForUser(db, ctx.from?.id ?? 0))) {
      return ctx.reply(...(await menuMessage(linked.desk.id, 'home', ctx.from?.id)))
    }
    return ctx.reply(...(await agentsMessage(ctx.from?.id, linked.desk.id)))
  })

  /** The owner's agents as buttons; the one the commands act on is marked. */
  async function agentsMessage(userId: number | undefined, currentId: string): Promise<[string, object]> {
    const all = userId === undefined ? [] : await desksForTelegramUser(db, userId)
    const kb = new InlineKeyboard()
    for (const d of all)
      kb.text(`${d.id === currentId ? '● ' : ''}${d.name ?? 'Agent'}`, `agent:${d.id}`).row()
    kb.text(telegramCopy.menu.back, 'menu:home')
    const current = all.find((d) => d.id === currentId)?.name ?? 'your agent'
    return [telegramCopy.pickAgent(current), { parse_mode: 'HTML', reply_markup: kb }]
  }

  bot.callbackQuery(/^agent:([0-9a-f-]{36})$/, async (ctx) => {
    const [, deskId] = ctx.match as unknown as [string, string]
    const set = await setTelegramCurrentDesk(db, ctx.from.id, deskId)
    if (!set) return ctx.answerCallbackQuery({ text: telegramCopy.notYourDesk, show_alert: true })
    const desk = await deskById(db, deskId)
    await ctx.answerCallbackQuery({ text: telegramCopy.switchedTo(desk?.name ?? 'Agent') })
    const [text, other] = await menuMessage(deskId, 'home', ctx.from.id)
    await ctx.editMessageText(text, other).catch(() => undefined)
  })

  // The brand first, as a photo, then the words and the buttons as their own message. A photo cannot be edited
  // into text later, and a missing picture must never cost the welcome.
  async function welcome(ctx: {
    replyWithPhoto: (photo: InputFile) => Promise<unknown>
    reply: (text: string, other?: object) => Promise<unknown>
  }) {
    await ctx.replyWithPhoto(new InputFile(resolve(ASSETS, 'welcome.png'))).catch(() => undefined)
    const button = canLinkButton(deps.siteUrl)
    return ctx.reply(telegramCopy.welcome(deps.siteUrl, button), {
      parse_mode: 'HTML',
      ...(button
        ? {
            reply_markup: new InlineKeyboard()
              .url(telegramCopy.connectButton, `${deps.siteUrl}/agents`)
              .url(telegramCopy.howButton, `${deps.siteUrl}/how-it-works`),
          }
        : {}),
    })
  }

  /**
   * One message, many views. The main menu and everything it opens are the same text message, edited in place,
   * so the chat never fills up with menus. Returns the arguments for `reply` or `editMessageText`.
   */
  async function menuMessage(deskId: string, view: MenuView, userId?: number): Promise<[string, object]> {
    const kb = new InlineKeyboard()
    const html = { parse_mode: 'HTML' as const }
    const desk = await deskById(db, deskId)
    const status = await buildStatus(db, deskId)
    const siteDesk = desk ? `${deps.siteUrl}/agents/${deskPath(desk)}` : deps.siteUrl
    if (view === 'portfolio') {
      kb.text(telegramCopy.menu.refresh, 'menu:portfolio').text(telegramCopy.menu.back, 'menu:home')
      const body = status ? telegramCopy.status(status) : telegramCopy.notCheckedYet
      return [telegramCopy.portfolioView(body), { ...html, reply_markup: kb }]
    }
    if (view === 'record') {
      const rows = await deskRecord(db, deskId, { limit: 5 })
      const lines = rows.map((r) =>
        telegramCopy.recordLine(
          ago(r.decidedAt),
          marketsCopy.outcomes[r.outcome] ?? r.outcome.replace(/_/g, ' '),
          r.summary,
        ),
      )
      const button = canLinkButton(deps.siteUrl)
      if (button) kb.url(telegramCopy.seeDetails, `${siteDesk}/record`).row()
      kb.text(telegramCopy.menu.back, 'menu:home')
      return [
        telegramCopy.recordView(lines, button ? undefined : `${siteDesk}/record`),
        { ...html, reply_markup: kb },
      ]
    }
    if (view === 'ask') {
      kb.text(telegramCopy.menu.back, 'menu:home')
      return [telegramCopy.askHint, { ...html, reply_markup: kb }]
    }
    const paused = desk?.state === 'paused_by_owner'
    kb.text(telegramCopy.menu.portfolio, 'menu:portfolio')
      .text(telegramCopy.menu.record, 'menu:record')
      .row()
      .text(
        paused ? telegramCopy.menu.resume : telegramCopy.menu.pause,
        paused ? 'menu:resume' : 'menu:pause',
      )
      .text(telegramCopy.menu.ask, 'menu:ask')
    // Switching needs a chat linked to the wallet; a chat linked the old way, per agent, has nothing to switch.
    if (
      userId !== undefined &&
      (await telegramOwnerForUser(db, userId)) &&
      (await desksForTelegramUser(db, userId)).length > 1
    ) {
      kb.row().text(telegramCopy.menu.agents, 'menu:agents')
    }
    if (canLinkButton(deps.siteUrl)) kb.row().url(telegramCopy.menu.open, siteDesk)
    return [
      telegramCopy.menu.title(
        desk?.name ?? 'Your agent',
        status?.mode ?? 'Practice',
        status?.state ?? 'active',
      ),
      { ...html, reply_markup: kb },
    ]
  }

  bot.command('portfolio', async (ctx) => {
    const linked = await deskOf(ctx.from?.id)
    if (!linked) return unlinked(ctx)
    return ctx.reply(...(await menuMessage(linked.desk.id, 'portfolio', ctx.from?.id)))
  })
  bot.command('record', async (ctx) => {
    const linked = await deskOf(ctx.from?.id)
    if (!linked) return unlinked(ctx)
    return ctx.reply(...(await menuMessage(linked.desk.id, 'record', ctx.from?.id)))
  })
  bot.command('ask', async (ctx) => {
    const linked = await deskOf(ctx.from?.id)
    if (!linked) return unlinked(ctx)
    return ctx.reply(...(await menuMessage(linked.desk.id, 'ask', ctx.from?.id)))
  })

  // Menu presses edit the message they came from. Pause and resume act, then show the menu with the other button.
  bot.callbackQuery(MENU, async (ctx) => {
    const [, action] = ctx.match as unknown as [string, string]
    const linked = await deskOf(ctx.from?.id)
    if (!linked) return ctx.answerCallbackQuery({ text: telegramCopy.notLinked, show_alert: true })
    let toast: string | undefined
    let view: MenuView = 'home'
    if (action === 'pause' || action === 'resume') {
      const run = action === 'pause' ? pauseDesk : resumeDesk
      const done = await run(db, linked.desk.id, { actor: 'owner', via: 'telegram' })
      log('telegram_command', { command: action, desk: linked.desk.address, done, via: 'menu' })
      toast = done ? (action === 'pause' ? 'Paused' : 'Active again') : 'It was already like that'
      if (done) await deps.refreshStatus(linked.desk.id).catch(() => false)
    } else if (action === 'agents') {
      await ctx.answerCallbackQuery()
      const [text, other] = await agentsMessage(ctx.from.id, linked.desk.id)
      return void (await ctx.editMessageText(text, other).catch(() => undefined))
    } else if (action === 'refresh') {
      // The ↻ under the pinned message: bring it up to date where it is.
      await deps.refreshStatus(linked.desk.id).catch(() => false)
      return ctx.answerCallbackQuery({ text: 'Up to date' })
    } else if (action !== 'home') {
      view = action as MenuView
    }
    await ctx.answerCallbackQuery(toast ? { text: toast } : {})
    const [text, other] = await menuMessage(linked.desk.id, view, ctx.from.id)
    await ctx.editMessageText(text, other).catch((e) => {
      // "message is not modified" means a second press on the same view: nothing to do.
      if (!errorText(e).includes('not modified')) throw e
    })
  })

  bot.command('help', (ctx) => ctx.reply(telegramCopy.help, { parse_mode: 'HTML' }))

  bot.command('status', async (ctx) => {
    const linked = await deskOf(ctx.from?.id)
    if (!linked) return (await walletOnly(ctx.from?.id)) ? noAgentYet(ctx) : ctx.reply(telegramCopy.notLinked)
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
      if (!linked)
        return (await walletOnly(ctx.from?.id)) ? noAgentYet(ctx) : ctx.reply(telegramCopy.notLinked)
      const done = await run(db, linked.desk.id, { actor: 'owner', via: 'telegram' })
      log('telegram_command', { command, desk: linked.desk.address, done })
      await ctx.reply(
        done
          ? command === 'pause'
            ? telegramCopy.paused
            : telegramCopy.resumed
          : telegramCopy.alreadyInThatState,
      )
      // The pinned message must not go on reading "active" for up to an hour after a pause.
      if (done) await deps.refreshStatus(linked.desk.id).catch(() => false)
    })
  }

  // The buttons on a request. The callback data carries the approval id and nothing else.
  bot.callbackQuery(/^(approve|reject):(.+)$/, async (ctx) => {
    const [, choice, approvalId] = ctx.match as unknown as [string, string, string]
    const linked = await deskOf(ctx.from?.id)
    if (!linked) return ctx.answerCallbackQuery({ text: telegramCopy.notLinked, show_alert: true })
    const found = await approvalById(db, approvalId)
    // The request must belong to one of THIS user's desks (not only the one the commands act on: a request
    // from any of the owner's agents arrives here). A button press proves nothing on its own.
    const mine = await desksForTelegramUser(db, ctx.from.id)
    const approvalDesk = found ? mine.find((d) => d.id === found.approval.deskId) : undefined
    if (!found || !approvalDesk) {
      return ctx.answerCallbackQuery({ text: telegramCopy.notYourDesk, show_alert: true })
    }
    const approvalOwner = await deskById(db, approvalDesk.id)

    const answer = choice === 'approve' ? 'approved' : 'rejected'
    const row = await answerApproval(db, {
      approvalId,
      answer,
      ownerId: approvalOwner?.ownerId ?? linked.desk.ownerId,
      via: 'telegram',
    })
    log('telegram_answer', {
      desk: approvalOwner?.address ?? linked.desk.address,
      approvalId,
      answer,
      accepted: Boolean(row),
    })
    if (!row) {
      // Answered on the website or in the chat first, or lapsed. The message shows what really happened,
      // never "expired" for a request the owner approved elsewhere.
      const fresh = (await approvalById(db, approvalId))?.approval
      const status = fresh?.status
      const ended =
        status === 'approved' || status === 'rejected' || status === 'expired' || status === 'cancelled'
          ? status
          : 'expired'
      const where =
        fresh?.answeredVia && fresh.answeredVia !== 'telegram'
          ? telegramCopy.answeredWhere[fresh.answeredVia]
          : undefined
      await ctx.answerCallbackQuery({ text: telegramCopy.alreadyAnswered, show_alert: true })
      return void (await ctx
        .editMessageText(telegramCopy.approvalAnswered(ended, found.decision.summary, where), {
          parse_mode: 'HTML',
        })
        .catch(() => undefined))
    }
    await ctx.answerCallbackQuery({ text: answer === 'approved' ? 'Approved' : 'Rejected' })
    await ctx.editMessageText(
      telegramCopy.approvalAnswered(answer, found.decision.summary, telegramCopy.answeredWhere.telegram),
      { parse_mode: 'HTML' },
    )
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

  // Free text is a message to the desk, answered by the same chat as the website. The answer is delivered by
  // the chat's loop when it is ready (see `deliverAskReply`), so this handler returns at once. A bare code from
  // an owner not yet linked still links, for owners who copy it rather than follow the link.
  bot.on('message:text', async (ctx) => {
    const text = ctx.message.text.trim()
    const linked = await deskOf(ctx.from.id)
    if (!linked) {
      if (CODE.test(text)) return void (await link(ctx, text))
      return unlinked(ctx)
    }
    // A slash command the bot does not know is not a question for the model.
    if (text.startsWith('/')) {
      const [word = ''] = text.split(/\s+/)
      if (!KNOWN_COMMANDS.has(word.toLowerCase())) return ctx.reply(telegramCopy.unknownCommand)
      return
    }
    const desk = await deskById(db, linked.desk.id)
    if (!desk) return ctx.reply(telegramCopy.notLinked)
    const allowed = await askAllowed(db, desk.ownerAddress)
    if (!allowed.ok) return ctx.reply(telegramCopy.askSlowDown[allowed.reason])

    await createAskRequest(db, {
      ownerAddress: desk.ownerAddress,
      deskId: desk.id,
      kind: 'ask',
      via: 'telegram',
      question: text.slice(0, 1000),
      // The chat id the answer goes back to. The loop delivers it; this handler does not wait.
      payload: { telegramChatId: ctx.chat.id },
    })
    deps.kickAsk?.()
    await ctx.replyWithChatAction('typing').catch(() => undefined)
    return ctx.reply(telegramCopy.askThinking)
  })

  bot.catch((e) => log('telegram_error', { error: errorText(e.error) }))

  async function link(
    ctx: {
      from?: { id: number; username?: string | undefined } | undefined
      chat?: { id: number } | undefined
      reply: (text: string, other?: object) => Promise<unknown>
    },
    code: string,
  ) {
    const from = ctx.from
    const chatId = ctx.chat?.id
    if (!from || chatId === undefined) return
    const chat = { userId: from.id, chatId, username: from.username ?? undefined }
    // Codes from Settings link the wallet; older codes from an agent's page link that one agent.
    const owned = await claimTelegramOwnerLink(db, code, chat)
    if (owned.ok && owned.desks === 0) {
      log('telegram_linked', { owner: owned.row.ownerId, user: from.id, desks: 0 })
      return void (await ctx.reply(telegramCopy.linkedNoAgent, { parse_mode: 'HTML' }))
    }
    const claim =
      owned.ok || owned.reason === 'another_desk' ? owned : await claimTelegramLink(db, code, chat)
    if (!claim.ok) {
      return void (await ctx.reply(
        claim.reason === 'another_desk' ? telegramCopy.linkedElsewhere : telegramCopy.linkUsed,
      ))
    }
    const linked = await deskOf(from.id)
    log('telegram_linked', { desk: linked?.desk.address, user: from.id })
    await ctx.reply(telegramCopy.firstContact(linked?.desk.name ?? 'your agent'), { parse_mode: 'HTML' })
    // Pin the status straight away. A desk that has been checking for hours should not greet its owner with
    // "it has not checked yet" and then say nothing until the next hour turns.
    if (linked) {
      await deps.refreshStatus(linked.desk.id)
      await ctx.reply(...(await menuMessage(linked.desk.id, 'home', from.id)))
    }
  }

  return bot
}

/**
 * The desk's answer to a Telegram message, sent when the chat's loop has it. A sign-in card gets Confirm and
 * Not now buttons; a card that needs the wallet or the session key gets a link to confirm on the website.
 */
export async function deliverAskReply(
  bot: Bot,
  deps: TelegramDeps,
  request: { id: string; ownerAddress: string; payload: Record<string, unknown> },
): Promise<void> {
  const chatId = request.payload.telegramChatId
  if (typeof chatId !== 'number') return
  // Disconnected while the answer was being written: the chat no longer hears about this wallet.
  if (!(await chatLinkedToOwner(deps.db, chatId, request.ownerAddress))) return
  const row = await askRequestForOwner(deps.db, request.id, request.ownerAddress)
  if (!row) return
  if (row.status === 'failed' || !row.reply) {
    await bot.api.sendMessage(chatId, row.error ?? telegramCopy.askFailed)
    return
  }
  const answer = row.reply as unknown as AskAnswer
  const body =
    answer.refused && answer.refused !== answer.reply ? `${answer.reply}\n\n${answer.refused}` : answer.reply
  const proposal = row.proposal
  if (proposal?.status !== 'open') {
    await bot.api.sendMessage(chatId, body)
    return
  }
  const card = proposal.deskView.card as { title?: string; after?: string[]; note?: string } | undefined
  const cardText = [card?.title, ...(card?.after ?? []), card?.note].filter(Boolean).join('\n')
  if (proposal.path === 'signin') {
    await bot.api.sendMessage(chatId, `${body}\n\n${cardText}`, {
      reply_markup: new InlineKeyboard()
        .text(telegramCopy.confirm, `ask:ok:${proposal.id}`)
        .text(telegramCopy.notNow, `ask:no:${proposal.id}`),
    })
    return
  }
  const desk = row.deskId ? await deskById(deps.db, row.deskId) : undefined
  const slug = desk ? deskPath(desk) : (row.deskId ?? '')
  await bot.api.sendMessage(chatId, `${body}\n\n${cardText}\n\n${telegramCopy.confirmOnSiteNote}`, {
    reply_markup: new InlineKeyboard().url(
      telegramCopy.confirmOnSite,
      `${deps.siteUrl}/agents/${slug}?proposal=${proposal.id}`,
    ),
  })
}

/**
 * The buttons under a request. "See the full decision" is a plain link: the share link when sharing is on,
 * else the owner's own page, which asks them to sign in.
 */
export function approvalKeyboard(approvalId: string, siteUrl: string, slug: string, seq: number) {
  return new InlineKeyboard()
    .text('Approve', `approve:${approvalId}`)
    .text('Reject', `reject:${approvalId}`)
    .row()
    .url(telegramCopy.seeDetails, `${siteUrl}/agents/${slug}/decision/${seq}`)
}

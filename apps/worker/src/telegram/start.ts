/**
 * Starts the desk's voice, if it has been given one.
 *
 * Without a bot token the desk works exactly as it does now: it checks, decides, records and seals. It simply
 * has nothing to say. Telegram is how the owner hears about it, never how anything is decided, so it must
 * never be able to stop the desk working.
 */
import { errorText } from '@desk/shared'
import type { Bot } from 'grammy'
import type { AskLoop } from '../ask'
import type { Cli, Log } from '../review'
import { createBot, deliverAskReply } from './bot'
import { drainOutbox, refreshStatus } from './outbox'
import { ensureProfile } from './profile'

export interface Telegram {
  bot: Bot
  drain: () => Promise<void>
  stop: () => Promise<void>
}

export function startTelegram(cli: Cli, log: Log, ask?: AskLoop): Telegram | undefined {
  const token = cli.env.TELEGRAM_BOT_TOKEN
  if (!token) {
    log('telegram_not_configured', { note: 'no TELEGRAM_BOT_TOKEN, so the desk runs without a voice' })
    return undefined
  }
  const siteUrl = cli.env.SITE_URL ?? 'http://localhost:3007'
  // The bot and the outbox need each other: the bot asks for the pinned message, the outbox writes it.
  // eslint-disable-next-line prefer-const
  let deps: Parameters<typeof drainOutbox>[0]
  const bot = createBot(token, {
    db: cli.db,
    log,
    siteUrl,
    refreshStatus: (deskId) => refreshStatus(deps, deskId),
    ...(ask ? { kickAsk: ask.kick } : {}),
  })
  deps = { db: cli.db, bot, log, siteUrl }
  // A message typed in Telegram is answered here, when the chat's loop has the answer. The handler that took
  // the message returned long ago, so no owner's question ever holds another owner's /pause.
  ask?.onAnswered(async (row) => {
    if (row.via !== 'telegram') return
    await deliverAskReply(
      bot,
      { db: cli.db, log, siteUrl, refreshStatus: (id) => refreshStatus(deps, id) },
      row,
    ).catch((e) => log('telegram_reply_failed', { request: row.id, error: errorText(e) }))
  })

  // The name, descriptions, commands and picture. Cosmetic, so it runs in the background and never blocks.
  void ensureProfile(bot, log)

  // Long polling, started in the background. It must never hold up the clock.
  void bot
    .start({
      onStart: (me) => log('telegram_listening', { username: me.username, id: me.id }),
      drop_pending_updates: true,
    })
    .catch((e) => log('telegram_stopped', { error: errorText(e) }))

  return {
    bot,
    drain: async () => {
      const sent = await drainOutbox(deps).catch((e) => {
        log('telegram_outbox_failed', { error: errorText(e) })
        return 0
      })
      if (sent > 0) log('telegram_sent', { messages: sent })
    },
    stop: () => bot.stop(),
  }
}

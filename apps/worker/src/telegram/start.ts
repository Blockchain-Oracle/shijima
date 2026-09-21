/**
 * Starts the desk's voice, if it has been given one.
 *
 * Without a bot token the desk works exactly as it does now: it checks, decides, records and seals. It simply
 * has nothing to say. Telegram is how the owner hears about it, never how anything is decided, so it must
 * never be able to stop the desk working.
 */
import { errorText } from '@desk/shared'
import type { Bot } from 'grammy'
import type { Cli, Log } from '../review'
import { createBot } from './bot'
import { drainOutbox, refreshStatus } from './outbox'

export interface Telegram {
  bot: Bot
  drain: () => Promise<void>
  stop: () => Promise<void>
}

export function startTelegram(cli: Cli, log: Log): Telegram | undefined {
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
  })
  deps = { db: cli.db, bot, log, siteUrl }

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

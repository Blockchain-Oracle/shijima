/**
 *   pnpm desk:link    make a one-time code that ties Telegram to the dev desk
 *
 * The code lives for ten minutes and works once. On the website this is a button and a QR code; here it is a
 * line to paste into the chat.
 */
import { randomBytes } from 'node:crypto'
import { createTelegramLink, linkForDesk } from '@desk/db'
import { errorText } from '@desk/shared'
import { openCli, readDevDesk, registerDevDesk } from './context'

const cli = await openCli()
try {
  const { deployment, state } = await readDevDesk(cli.deps)
  const desk = await registerDevDesk(cli.db, deployment, state)
  const already = await linkForDesk(cli.db, desk.id)
  if (already) {
    console.log(
      `this desk is already linked to Telegram${already.telegramUsername ? ` as @${already.telegramUsername}` : ''}.`,
    )
  } else {
    const code = randomBytes(4).toString('hex')
    await createTelegramLink(cli.db, desk.id, code)
    const bot = process.env.TELEGRAM_BOT_USERNAME ?? 'ShijimaBot'
    console.log(`open https://t.me/${bot}?start=${code}`)
    console.log(`or send this code to the bot: ${code}`)
    console.log('it works once, and only for the next ten minutes.')
  }
} catch (e) {
  console.error(errorText(e))
  process.exitCode = 1
} finally {
  await cli.close()
}

/**
 * The bot's face: its name, what it says before anyone presses Start, its commands and its picture.
 *
 * Set at every boot, but only where Telegram's copy differs from ours. `setMyName` in particular is rate-limited
 * hard, and a worker that restarts twice in a minute must not lock the bot out of its own name.
 */
import { resolve } from 'node:path'
import { errorText, telegramCopy } from '@desk/shared'
import { type Bot, InputFile } from 'grammy'
import { WORKER_ROOT } from '../cli/context'
import type { Log } from '../review'

export const ASSETS = resolve(WORKER_ROOT, 'assets')

export async function ensureProfile(bot: Bot, log: Log): Promise<void> {
  const p = telegramCopy.profile
  const changed: string[] = []
  const step = async (name: string, run: () => Promise<boolean>) => {
    try {
      if (await run()) changed.push(name)
    } catch (e) {
      // A profile that could not be set is cosmetic. The bot answers exactly as before.
      log('telegram_profile_failed', { step: name, error: errorText(e) })
    }
  }

  await step('name', async () => {
    if ((await bot.api.getMyName()).name === p.name) return false
    return bot.api.setMyName(p.name)
  })
  await step('description', async () => {
    if ((await bot.api.getMyDescription()).description === p.description) return false
    return bot.api.setMyDescription(p.description)
  })
  await step('short_description', async () => {
    if ((await bot.api.getMyShortDescription()).short_description === p.shortDescription) return false
    return bot.api.setMyShortDescription(p.shortDescription)
  })
  await step('commands', async () => {
    const now = await bot.api.getMyCommands()
    const same =
      now.length === p.commands.length &&
      now.every(
        (c, i) => c.command === p.commands[i]?.command && c.description === p.commands[i]?.description,
      )
    if (same) return false
    return bot.api.setMyCommands([...p.commands])
  })
  await step('photo', async () => {
    // Set once. Telegram gives no fingerprint of the current picture, so an existing one is left alone.
    const me = await bot.api.getMe()
    if ((await bot.api.getUserProfilePhotos(me.id, { limit: 1 })).total_count > 0) return false
    return bot.api.setMyProfilePhoto({ type: 'static', photo: new InputFile(resolve(ASSETS, 'avatar.jpg')) })
  })

  if (changed.length > 0) log('telegram_profile_set', { changed })
}

/**
 * Copy trading from the command line, for testing (D4, D5). Each agent is named by its id, public slug, address or
 * name. Nothing here sends a transaction: the copies themselves are made by the worker's pass (`pnpm desk:review`).
 *
 *   pnpm --filter @desk/worker copy --copyable <agent> --fee <usd>   let others copy it, for a one-time $0 to $5
 *   pnpm --filter @desk/worker copy --copyable <agent> --off         stop new followers
 *   pnpm --filter @desk/worker copy --follower <agent> --leader <agent>   start copying
 *   pnpm --filter @desk/worker copy --follower <agent> --pause | --resume | --stop
 *   pnpm --filter @desk/worker copy --list <agent>                   who copies it, and whom it copies
 */
import {
  CopyLinkError,
  deskByRef,
  followersOf,
  leaderOf,
  pauseCopying,
  resumeCopying,
  setCopyable,
  startCopying,
  stopCopying,
} from '@desk/db'
import { errorText } from '@desk/shared'
import { formatUnits, parseUnits } from 'viem'
import { openCli } from './context'

const arg = (flag: string) => {
  const i = process.argv.indexOf(flag)
  const value = i === -1 ? undefined : process.argv[i + 1]
  return value && !value.startsWith('--') ? value : undefined
}
const has = (flag: string) => process.argv.includes(flag)
const usd = (v: bigint) => `$${formatUnits(v, 6)}`
const by = { actor: 'owner', via: 'worker' } as const

const cli = await openCli()
try {
  const find = async (ref: string | undefined, role: string) => {
    if (!ref) throw new CopyLinkError(`name the ${role}: its id, slug, address or name`)
    const desk = await deskByRef(cli.db, ref)
    if (!desk) throw new CopyLinkError(`no agent is called "${ref}"`)
    return desk
  }

  if (has('--copyable')) {
    const desk = await find(arg('--copyable'), 'agent')
    const fee = arg('--fee')
    await setCopyable(cli.db, desk.id, {
      copyable: !has('--off'),
      ...(fee === undefined ? {} : { feeUsdg: parseUnits(fee, 6) }),
    })
    console.log(
      has('--off')
        ? `${desk.name ?? desk.address} no longer takes new followers`
        : `${desk.name ?? desk.address} can be copied${fee === undefined ? '' : `, for a one-time ${usd(parseUnits(fee, 6))}`}`,
    )
  } else if (has('--list')) {
    const desk = await find(arg('--list'), 'agent')
    const leader = await leaderOf(cli.db, desk.id)
    console.log(
      `${desk.name ?? desk.address}: copyable ${desk.copyable}, fee ${usd(desk.copyFeeUsdg)}. ${leader ? `Copies ${leader.name ?? leader.address} (${leader.link.status}).` : 'Copies nobody.'}`,
    )
    for (const f of await followersOf(cli.db, desk.id)) {
      console.log(
        `  follower ${f.name ?? f.address} (${f.mode}): ${f.link.status} since ${f.link.activeSince.toISOString()}`,
      )
    }
  } else {
    const follower = await find(arg('--follower'), 'follower')
    if (has('--pause')) {
      const row = await pauseCopying(cli.db, follower.id)
      console.log(
        row
          ? 'copying is paused. Moves the leader makes now are not copied.'
          : 'it was not copying, so nothing changed.',
      )
    } else if (has('--resume')) {
      const row = await resumeCopying(cli.db, follower.id)
      console.log(row ? 'copying again, from now on.' : 'it was not paused, so nothing changed.')
    } else if (has('--stop')) {
      const row = await stopCopying(cli.db, follower.id, by)
      console.log(
        row ? 'copying stopped. The agent runs on its own again from its next check.' : 'it was not copying.',
      )
    } else {
      const leader = await find(arg('--leader'), 'leader')
      const link = await startCopying(cli.db, { followerDeskId: follower.id, leaderDeskId: leader.id, by })
      console.log(
        `${follower.name ?? follower.address} now copies ${leader.name ?? leader.address} (link ${link.id}, fee ${usd(link.feeUsdg)}). Its own rebalancing is off.`,
      )
    }
  }
} catch (e) {
  console.error(errorText(e))
  process.exitCode = 1
} finally {
  await cli.close()
}

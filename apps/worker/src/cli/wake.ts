/**
 * One real check of the dev desk, exactly as the hourly clock will run it.
 *
 *   pnpm desk:wake            check now, record what was decided, act if the mode allows it
 *   pnpm desk:wake --dry      read, value and ask the model, then commit nothing and send nothing
 *   pnpm desk:wake --force    DEVELOPER ONLY: act even if the model says wait, recorded as an override
 *   pnpm desk:mode shadow|ask_first|on_its_own
 *   pnpm desk:pause   ·   pnpm desk:resume
 *   pnpm desk:share <slug> | --off   turn the read-only public link on or off
 *
 * Like every command, it first settles anything an earlier run left unfinished, and sends nothing new while
 * an earlier transaction may still land.
 */
import { APPROVED_TOKENS } from '@desk/chain'
import { type SendReport, wakeDesk } from '@desk/core'
import { pauseDesk, resumeDesk, setDeskMode, setDeskShare } from '@desk/db'
import { errorText } from '@desk/shared'
import { requireLeader } from '../leader'
import { resolveUnsettled, sendAction } from '../sender'
import {
  assertChainSeqAgrees,
  implementationsByVersion,
  openCli,
  printSettlements,
  readDevDesk,
  registerDevDesk,
} from './context'

const MODES = ['shadow', 'ask_first', 'on_its_own'] as const
const dry = process.argv.includes('--dry')
const force = process.argv.includes('--force')
const modeIndex = process.argv.indexOf('--set-mode')
const newMode = modeIndex === -1 ? undefined : MODES.find((m) => m === process.argv[modeIndex + 1])

const cli = await openCli()
// One operator key means one sender. The worker holds this lock while it runs.
const leader = await requireLeader(cli.pool, 'a check by hand')
try {
  const { deployment, state } = await readDevDesk(cli.deps)
  const desk = await registerDevDesk(cli.db, deployment, state)

  const by = { actor: 'owner', via: 'worker' } as const
  const shareIndex = process.argv.indexOf('--share')
  if (shareIndex !== -1) {
    const slug = process.argv[shareIndex + 1]
    const off = process.argv.includes('--off')
    if (!slug || slug.startsWith('--')) throw new Error('give a slug: pnpm desk:share my-desk')
    if (!/^[a-z0-9][a-z0-9-]{1,40}$/.test(slug))
      throw new Error('a slug is lower case letters, numbers and dashes')
    await setDeskShare(cli.db, desk.id, { slug, enabled: !off }, by)
    console.log(
      off ? `the public link is off (${slug})` : `anyone with the link can now watch: /desk/${slug}`,
    )
  } else if (process.argv.includes('--pause')) {
    const done = await pauseDesk(cli.db, desk.id, by)
    console.log(
      done
        ? 'the desk is paused. Pending approvals and remembered decisions were cancelled.'
        : 'the desk was not active, so nothing changed.',
    )
  } else if (process.argv.includes('--resume')) {
    const done = await resumeDesk(cli.db, desk.id, by)
    console.log(done ? 'the desk is active again.' : 'the desk was not paused, so nothing changed.')
  } else if (modeIndex !== -1) {
    if (!newMode) throw new Error(`the mode must be one of: ${MODES.join(', ')}`)
    await setDeskMode(cli.db, desk.id, newMode, { actor: 'owner', via: 'worker' })
    console.log(`the desk is now in ${newMode} mode. Pending approvals and remembered waits were cancelled.`)
  } else {
    const settled = await resolveUnsettled(cli.deps)
    printSettlements(settled)
    if (settled.some((s) => s.now === 'waiting')) {
      throw new Error('An earlier transaction may still land. Nothing new is sent until it is settled.')
    }
    assertChainSeqAgrees(desk, state, cli.env.isRehearsal, true)

    const report = await wakeDesk(
      {
        db: cli.db,
        pub: cli.pub,
        approved: APPROVED_TOKENS,
        servApiKey: cli.env.SERV_API_KEY,
        finnhubKey: process.env.FINNHUB_API_KEY,
        operator: cli.wallet.account.address,
        implementations: implementationsByVersion(),
        log: (line) => console.log(line),
        send: async (action, call): Promise<SendReport> => {
          const sent = await sendAction(cli.deps, action, call)
          if (sent.status === 'refused') return sent
          if (sent.status === 'reverted') return { status: 'reverted', txHash: sent.outcome.txHash }
          const { txHash, eventHash, chainSeq, amountOut } = sent.outcome
          return {
            status: 'confirmed',
            txHash,
            eventHash,
            chainSeq,
            ...(amountOut === undefined ? {} : { amountOut }),
          }
        },
      },
      { deskId: desk.id, scheduledFor: new Date(), trigger: 'manual', dry, force },
    )
    console.log(
      `${dry ? 'DRY RUN, nothing was saved or sent. ' : ''}check ${report.status}${report.note ? `: ${report.note}` : ''}`,
    )
    if (report.status === 'failed') process.exitCode = 1
  }
} catch (e) {
  console.error(errorText(e))
  process.exitCode = 1
} finally {
  await leader.release()
  await cli.close()
}

/**
 * Answers a request the desk is waiting on. LOCAL DEVELOPMENT: the owner does this on the website or in
 * Telegram, and both use the very same guarded update.
 *
 *   pnpm desk:approvals          what is waiting, and until when
 *   pnpm desk:approve            approve the oldest waiting request
 *   pnpm desk:reject             reject it
 *   pnpm desk:approve --id <id>  answer one exactly
 *
 * Answering does not trade. The worker's next check re-reads the price and every rule, and acts only if the
 * price is still close to what was shown.
 */
import { answerApproval, pendingApprovals } from '@desk/db'
import { errorText } from '@desk/shared'
import { openCli, readDevDesk, registerDevDesk } from './context'

const answer = process.argv.includes('--reject') ? 'rejected' : 'approved'
const listOnly = process.argv.includes('--list')
const idIndex = process.argv.indexOf('--id')
const wantedId = idIndex === -1 ? undefined : process.argv[idIndex + 1]

const cli = await openCli()
try {
  const { deployment, state } = await readDevDesk(cli.deps)
  const desk = await registerDevDesk(cli.db, deployment, state)
  const waiting = await pendingApprovals(cli.db, desk.id)

  if (waiting.length === 0) {
    console.log('nothing is waiting for you.')
  } else if (listOnly) {
    for (const a of waiting) {
      const left = Math.round((a.expiresAt.getTime() - Date.now()) / 60_000)
      console.log(`${a.id}\n  record ${a.decisionSeq}: ${a.summary}`)
      const shown = a.preview as { amountIn?: string; expectedOut?: string }
      console.log(
        `  ${a.side} ${shown.amountIn ?? '?'} for about ${shown.expectedOut ?? '?'} · asked because ${a.reason} · ${left > 0 ? `${left} minutes left` : 'expired'}`,
      )
    }
  } else {
    const target = wantedId ? waiting.find((a) => a.id === wantedId) : waiting.at(-1)
    if (!target) throw new Error(wantedId ? `no request waiting with id ${wantedId}` : 'nothing is waiting')
    const row = await answerApproval(cli.db, {
      approvalId: target.id,
      answer,
      ownerId: desk.ownerId,
      via: 'web',
    })
    if (!row) {
      console.log('that request is no longer waiting: it expired, or it was already answered.')
    } else {
      console.log(`record ${target.decisionSeq} ${answer}.`)
      console.log(
        answer === 'approved'
          ? '  The desk will re-read the price on its next check and act only if it is still close to what you were shown.'
          : '  Nothing will be done. The refusal is recorded.',
      )
    }
  }
} catch (e) {
  console.error(errorText(e))
  process.exitCode = 1
} finally {
  await cli.close()
}

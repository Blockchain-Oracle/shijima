/**
 *   pnpm desk:grade    grade every weekend decision that the reopen has now settled
 *
 * Reads only. It never trades and never asks a model. The worker runs the same job every tick.
 */
import { APPROVED_TOKENS } from '@desk/chain'
import { chainReferenceSource, gradeAtReopen, lastSettledReopen } from '@desk/core'
import { errorText, newYorkTime } from '@desk/shared'
import { openCli, readDevDesk, registerDevDesk } from './context'

const cli = await openCli()
try {
  const { deployment, state } = await readDevDesk(cli.deps)
  const desk = await registerDevDesk(cli.db, deployment, state)
  const settled = lastSettledReopen(new Date())
  console.log(
    settled
      ? `grading against the price half an hour after the open on ${newYorkTime(settled)}`
      : 'the market has not reopened yet, so there is nothing to grade against',
  )
  const report = await gradeAtReopen(
    {
      db: cli.db,
      approved: APPROVED_TOKENS,
      reference: chainReferenceSource(cli.db, cli.pub),
      log: (line) => console.log(`  ${line}`),
    },
    desk.id,
  )
  console.log(
    `${report.graded.length} graded${report.waiting > 0 ? `, ${report.waiting} could not be graded yet` : ''}`,
  )
} catch (e) {
  console.error(errorText(e))
  process.exitCode = 1
} finally {
  await cli.close()
}

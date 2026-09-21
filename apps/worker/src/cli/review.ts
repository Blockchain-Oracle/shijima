/**
 *   pnpm desk:review    one pass of exactly what the worker does each tick: "check now" requests, the hourly
 *                       check if it is due, grading and the daily seal. Then it exits.
 *
 * No Telegram bot and no OpenServ agent start, so it is safe to run against a rehearsal fork. It takes the same
 * leader lock as the worker, so it refuses while the worker is running.
 */
import { errorText } from '@desk/shared'
import { requireLeader } from '../leader'
import { reviewAllDesks } from '../review'
import { openCli } from './context'

const cli = await openCli()
const leader = await requireLeader(cli.pool, 'one review pass by hand')
try {
  const summary = await reviewAllDesks(cli, (event, detail = {}) =>
    console.log(JSON.stringify({ event, ...detail })),
  )
  console.log(JSON.stringify({ event: 'summary', ...summary }))
} catch (e) {
  console.error(errorText(e))
  process.exitCode = 1
} finally {
  await leader.release()
  await cli.close()
}

/**
 *   pnpm desk:resolve    settle every operator transaction an earlier run left unfinished
 *
 * The same function the worker runs on every boot. It never sends anything. It only asks the chain.
 */

import { errorText } from '@desk/shared'
import { requireLeader } from '../leader'
import { resolveUnsettled } from '../sender'
import { openCli, printSettlements } from './context'

const cli = await openCli()
// One operator key means one sender. The worker holds this lock while it runs.
const leader = await requireLeader(cli.pool, 'settling by hand')
try {
  const settled = await resolveUnsettled(cli.deps)
  printSettlements(settled)
  if (settled.some((s) => s.now === 'waiting')) process.exitCode = 2
} catch (e) {
  console.error(errorText(e))
  process.exitCode = 1
} finally {
  await leader.release()
  await cli.close()
}

/**
 *   pnpm openserv:fire    ask OpenServ to run the hourly workflow now
 *
 * The same path the platform's own cron takes, without waiting for the top of the hour. The worker must be
 * running: the platform calls it through the proxy, and the work happens there, not here.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { errorText } from '@desk/shared'
import { PlatformClient } from '@openserv-labs/client'
import { WORKER_ROOT } from '../cli/context'
import { AGENT_NAME } from './agent'

const WORKFLOW_NAME = 'Hourly desk review'

const userApiKey = process.env.OPENSERV_USER_API_KEY
if (!userApiKey) {
  console.error('OPENSERV_USER_API_KEY is missing from .env.')
  process.exit(1)
}

try {
  const stateFile = process.env.OPENSERV_STATE_FILE ?? resolve(WORKER_ROOT, '.openserv.json')
  const state = JSON.parse(readFileSync(stateFile, 'utf8')) as {
    workflows?: Record<string, Record<string, { workspaceId?: number; triggerId?: string }>>
  }
  const workflow = state.workflows?.[AGENT_NAME]?.[WORKFLOW_NAME]
  if (!workflow?.workspaceId || !workflow.triggerId) {
    throw new Error('this machine has not registered the workflow. Run: pnpm openserv:provision')
  }
  const client = new PlatformClient({ apiKey: userApiKey })
  await client.triggers.fire({ workflowId: workflow.workspaceId, id: workflow.triggerId })
  console.log(
    `asked OpenServ to run "${WORKFLOW_NAME}" now. Watch the worker's log: it should show openserv_task.`,
  )
} catch (e) {
  console.error(errorText(e))
  process.exitCode = 1
}

/**
 * Starts the OpenServ side of the worker, but only once the agent has actually been registered.
 *
 * Registration writes `.openserv.json`. Until that file exists there is nothing to connect to, so the worker
 * runs on its own timer alone and says so. This keeps the platform an addition to the desk rather than
 * something it depends on to work.
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { errorText, registerSecrets } from '@desk/shared'
import { getProvisionedInfo, PlatformClient } from '@openserv-labs/client'
import { run } from '@openserv-labs/sdk'
import { WORKER_ROOT } from '../cli/context'
import type { Cli, Log } from '../review'
import { AGENT_NAME, type AgentCredentials, createDeskAgent } from './agent'

const WORKFLOW_NAME = 'Hourly desk review'

export async function startAgentIfProvisioned(
  cli: Cli,
  log: Log,
): Promise<{ stop: () => Promise<void>; agentId: number | null; workflowId: number | null } | undefined> {
  const stateFile = process.env.OPENSERV_STATE_FILE ?? resolve(WORKER_ROOT, '.openserv.json')
  if (!existsSync(stateFile)) {
    log('openserv_not_registered', {
      note: 'running on the timer alone. Register with: pnpm openserv:provision',
    })
    return undefined
  }
  // The state file holds a live API key and auth token for this agent. Register them before anything can
  // throw, so a platform error can never carry them into a log or into the database.
  registerAgentSecrets(stateFile)
  try {
    const info = getProvisionedInfo(AGENT_NAME, WORKFLOW_NAME)
    const credentials = savedCredentials(stateFile)
    if (!credentials) {
      log('openserv_no_credentials', { note: 'the state file has no key for this agent. Provision again.' })
      return undefined
    }
    const agent = createDeskAgent(cli, log, credentials)
    // The SDK registers its own signal handlers by default, which would race the worker's shutdown.
    const running = await run(agent, { handleSignals: false })
    log('openserv_listening', { agent: AGENT_NAME, workflow: WORKFLOW_NAME, id: info?.agentId })
    await reactivateTrigger(info, log)
    return { stop: running.stop, agentId: info?.agentId ?? null, workflowId: info?.workflowId ?? null }
  } catch (e) {
    // The platform being unreachable must never stop the desk: the timer is the safety net for exactly this.
    log('openserv_failed', { error: errorText(e), note: 'the desk carries on using its own timer' })
    return undefined
  }
}

/**
 * The platform may switch a trigger off, for example after a run it could not deliver. Every boot asks for it
 * to be on again, with the user key that owns the workflow. Best effort: the worker's own timer is the safety net.
 */
async function reactivateTrigger(info: ReturnType<typeof getProvisionedInfo>, log: Log): Promise<void> {
  if (!info?.workflowId || !info.triggerId) return
  if (!process.env.OPENSERV_USER_API_KEY) {
    log('openserv_trigger_unchecked', {
      note: 'no OPENSERV_USER_API_KEY, so the trigger was not re-activated',
    })
    return
  }
  try {
    const client = new PlatformClient({ apiKey: process.env.OPENSERV_USER_API_KEY })
    await client.workflows.setRunning({ id: info.workflowId })
    await client.triggers.activate({ workflowId: info.workflowId, id: info.triggerId })
    log('openserv_trigger_active', { workflow: info.workflowId, trigger: info.triggerId })
  } catch (e) {
    log('openserv_trigger_failed', { error: errorText(e), note: 'the timer covers it' })
  }
}

function registerAgentSecrets(stateFile: string): void {
  try {
    const state = JSON.parse(readFileSync(stateFile, 'utf8')) as Record<string, unknown>
    const values: string[] = []
    const walk = (v: unknown) => {
      if (typeof v === 'string') values.push(v)
      else if (v && typeof v === 'object') Object.values(v).forEach(walk)
    }
    walk(state)
    registerSecrets(...values)
  } catch {
    // An unreadable state file is handled by the caller. There is simply nothing to register.
  }
}

/** The key and token this agent was given when it was registered. They live only in the gitignored state file. */
function savedCredentials(stateFile: string): AgentCredentials | undefined {
  try {
    const state = JSON.parse(readFileSync(stateFile, 'utf8')) as {
      agents?: Record<string, { apiKey?: string; authToken?: string }>
    }
    const agent = state.agents?.[AGENT_NAME]
    return agent?.apiKey && agent.authToken ? { apiKey: agent.apiKey, authToken: agent.authToken } : undefined
  } catch {
    return undefined
  }
}

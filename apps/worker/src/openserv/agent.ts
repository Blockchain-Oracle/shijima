/**
 * The desk as an agent on the OpenServ platform.
 *
 * `doTask` is overridden on purpose. Left alone, the SDK hands the task to the platform's own model, which
 * picks a capability and invents its arguments. This desk moves real money inside on-chain limits, so nothing
 * chooses its actions but its own engine. The platform's job here is the clock and the public record of runs.
 *
 * The work is exactly `reviewAllDesks`: the same function the worker's own timer calls. Whichever clock gets
 * to an hour first does the work, because a check is keyed on (desk, hour), and the other finds it done.
 */

import { errorText } from '@desk/shared'
import { Agent } from '@openserv-labs/sdk'
import type { DoTaskActionSchema } from '@openserv-labs/sdk/dist/types.js'
import { z } from 'zod'
import { type Cli, type Log, reviewAllDesks } from '../review'

export const AGENT_NAME = 'shijima'
export const AGENT_DESCRIPTION =
  'Shijima (しじま). Keeps one owner Stock Token portfolio to its written mandate while the US market is shut, on Robinhood Chain. It decides only WHEN to act, never what to own, and every decision including doing nothing is recorded and fingerprinted on-chain.'

export interface AgentCredentials {
  /** Identifies this agent to the platform. */
  apiKey: string
  /** Validates that an incoming request really came from the platform. */
  authToken: string
}

export function createDeskAgent(cli: Cli, log: Log, credentials?: AgentCredentials): Agent {
  const review = async (trigger: string) => {
    log('openserv_task', { trigger })
    const summary = await reviewAllDesks(cli, log, { trigger: 'cron' })
    return summary
  }

  class DeskAgent extends Agent {
    protected override async doTask(action: DoTaskActionSchema): Promise<void> {
      const workspaceId = action.workspace.id
      const taskId = action.task.id
      try {
        await this.updateTaskStatus({ workspaceId, taskId, status: 'in-progress' })
        const summary = await review(action.task.triggerEvent?.trigger_name ?? 'task')
        // NOT completeTask. SDK 2.4.1 sends `output` as a string, and the platform now wants an object plus
        // an outputOptionId, so it answers 400. Logging the summary and marking the task done uses only
        // endpoints that work today, and it leaves the same record on the task.
        await this.addLogToTask({
          workspaceId,
          taskId,
          severity: 'info',
          type: 'text',
          body: summarise(summary),
        })
        await this.updateTaskStatus({ workspaceId, taskId, status: 'done' })
      } catch (e) {
        const error = platformError(e)
        log('openserv_task_failed', { error, workspaceId, taskId })
        await this.markTaskAsErrored({ workspaceId, taskId, error }).catch((inner) => {
          log('openserv_error_report_failed', { error: platformError(inner) })
        })
      }
    }
  }

  const agent = new DeskAgent({
    systemPrompt:
      'You are the after-hours desk. You do not decide anything here: your engine does, inside on-chain limits.',
    // Registering binds these itself. Starting later reads them back from the saved state.
    ...(credentials ?? {}),
  })

  // One capability, so the agent page states plainly what it can be asked to do.
  agent.addCapability({
    name: 'review_desks',
    description: 'Check every running desk once, and act only within each owner mandate and on-chain limits.',
    schema: z.object({
      reason: z.string().optional().describe('Why this run was asked for. Recorded, never acted on.'),
    }),
    async run({ args }) {
      const summary = await review(args.reason ?? 'capability')
      return summarise(summary)
    },
  })

  return agent
}

function summarise(s: Awaited<ReturnType<typeof reviewAllDesks>>): string {
  if (s.held) return 'Held: an earlier transaction may still land, so nothing new was sent.'
  const checks = s.checks.map((c) => `${c.desk} ${c.status} (${c.records} records)`).join(', ')
  return [
    `${s.desks} desk${s.desks === 1 ? '' : 's'} reviewed.`,
    s.checks.length > 0 ? `Checked: ${checks}.` : 'Every desk had already been checked this hour.',
    s.graded > 0 ? `${s.graded} earlier decisions graded against the reopen.` : '',
    s.sealed > 0 ? `${s.sealed} record chain sealed on-chain.` : '',
  ]
    .filter(Boolean)
    .join(' ')
}

/**
 * What the platform actually objected to. Its SDK uses axios, and a bare "status code 400" says nothing, so
 * the response body is pulled out where there is one. Redacted like every other error before it is logged.
 */
function platformError(e: unknown): string {
  const response = (e as { response?: { status?: number; data?: unknown } }).response
  if (!response) return errorText(e)
  const body = typeof response.data === 'string' ? response.data : JSON.stringify(response.data)
  return errorText(new Error(`${response.status ?? '?'}: ${body ?? 'no body'}`), 600)
}

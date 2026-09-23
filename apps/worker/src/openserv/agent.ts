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

import { runningDesks, workerBeat } from '@desk/db'
import { errorText } from '@desk/shared'
import { Agent } from '@openserv-labs/sdk'
import type { DoTaskActionSchema, RespondChatMessageActionSchema } from '@openserv-labs/sdk/dist/types.js'
import { z } from 'zod'
import { type Cli, type Log, type ReviewSummary, reviewAllDesksExclusive } from '../review'
import { answerWorkspace } from './talk'

export const AGENT_NAME = 'shijima'
export const AGENT_DESCRIPTION =
  'Shijima (しじま) is an AI agent that keeps one person’s basket of US Stock Tokens on plan around the clock, on Robinhood Chain, inside limits their own account enforces. It decides only WHEN to move, never what to own, and fingerprints every decision on-chain. Link your workspace to your desk with a code from the website (send: link ABC123), then ask it how your portfolio is doing, why it waited, or to check now. Anything that moves money comes back as a link to confirm on your desk.'

/** Our own workflow's goal and task, as provisioned. Only a task that carries both runs the review pass. */
export const HOURLY_GOAL =
  'Every hour, check each running desk against its owner mandate and act only within the limits that desk enforces on-chain.'
export const HOURLY_TASK = 'Run the hourly desk review'

/**
 * A workspace's lasting key. The platform sends a fresh `workspace.id` on every run (it names the session), but the
 * workspace's file bucket stays the same, so links are kept against that.
 */
const workspaceKey = (w: { id: number | string; bucket_folder?: string }) => w.bucket_folder || String(w.id)

export interface AgentCredentials {
  /** Identifies this agent to the platform. */
  apiKey: string
  /** Validates that an incoming request really came from the platform. */
  authToken: string
}

export function createDeskAgent(cli: Cli, log: Log, credentials?: AgentCredentials): Agent {
  const review = async (trigger: string) => {
    log('openserv_task', { trigger })
    // The same pass the timer runs, never beside it: one operator key, one pass at a time.
    const summary = await reviewAllDesksExclusive(cli, log, { trigger: 'cron' })
    return summary
  }

  class DeskAgent extends Agent {
    /**
     * A person talking to Shijima inside their own workspace. The platform's model is never asked: the message
     * goes to the desk the workspace is linked to, and the answer comes from the same brain as the website's chat.
     */
    protected override async respondToChat(action: RespondChatMessageActionSchema): Promise<void> {
      const workspaceId = action.workspace.id
      const last = [...(action.messages ?? [])].reverse().find((m) => m.author === 'user')
      if (!last) return
      try {
        const reply = await answerWorkspace(cli, log, workspaceKey(action.workspace), last.message)
        await this.sendChatMessage({ workspaceId, agentId: action.me.id, message: reply })
      } catch (e) {
        log('openserv_chat_failed', { workspace: workspaceId, error: platformError(e) })
      }
    }

    protected override async doTask(action: DoTaskActionSchema): Promise<void> {
      const workspaceId = action.workspace.id
      const taskId = action.task.id
      log('openserv_task_in', {
        workspace: workspaceId,
        goal: action.workspace.goal.slice(0, 80),
        key: workspaceKey(action.workspace),
        task: String(action.task.description).slice(0, 80),
        execution: action.workspaceExecutionId ?? null,
      })
      // A task from anyone else's workspace is a question for the desk that workspace is linked to. Only our own
      // workflow's task runs the review, so no outside workspace can add a clock to the desk's.
      const own = action.task.description === HOURLY_TASK && action.workspace.goal === HOURLY_GOAL
      if (!own) {
        try {
          await this.updateTaskStatus({ workspaceId, taskId, status: 'in-progress' })
          const question = [
            ...new Set(
              [action.task.description, action.task.body, action.task.input].filter(
                (x): x is string => typeof x === 'string' && x.trim().length > 0,
              ),
            ),
          ].join('\n')
          const answer = await answerWorkspace(cli, log, workspaceKey(action.workspace), question)
          await this.addLogToTask({ workspaceId, taskId, severity: 'info', type: 'text', body: answer })
          await this.updateTaskStatus({ workspaceId, taskId, status: 'done' })
        } catch (e) {
          const error = platformError(e)
          log('openserv_task_failed', { error, workspaceId, taskId })
          await this.markTaskAsErrored({ workspaceId, taskId, error }).catch(() => undefined)
        }
        return
      }
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

  // One capability, so the agent page states plainly what it can be asked to do. It READS: the hourly review
  // is started by the workflow's cron trigger and by nothing a chat can say, so a stray request to the agent
  // can never add a third clock beside the platform's and the worker's.
  agent.addCapability({
    name: 'desk_status',
    description:
      'Say how many desks are running and when the worker last completed a pass. Reads only; it never starts a check.',
    schema: z.object({
      reason: z.string().optional().describe('Why this was asked. Recorded, never acted on.'),
    }),
    async run({ args }) {
      log('openserv_capability', { reason: args.reason ?? null })
      const [desks, beat] = await Promise.all([runningDesks(cli.db), workerBeat(cli.db)])
      return `${desks.length} desk${desks.length === 1 ? '' : 's'} running. The worker's last pass finished ${beat ? beat.beatAt.toISOString() : 'never'}. Checks run on the hourly trigger, not on request.`
    },
  })

  return agent
}

function summarise(s: ReviewSummary): string {
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

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

import { checkRequestStatus, runningDesks, workerBeat } from '@desk/db'
import { errorText } from '@desk/shared'
import { Agent } from '@openserv-labs/sdk'
import type {
  ActionSchema,
  DoTaskActionSchema,
  RespondChatMessageActionSchema,
} from '@openserv-labs/sdk/dist/types.js'
import { z } from 'zod'
import { type Cli, type Log, type ReviewSummary, reviewAllDesksExclusive } from '../review'
import { agentStatus, type CallerSession, checkNow, latestDecisions, proposeChange } from './capabilities'
import { answerWorkspace } from './talk'

export const AGENT_NAME = 'shijima'
export const AGENT_DESCRIPTION =
  'Shijima (しじま) is an AI agent that keeps one person’s basket of US Stock Tokens on plan around the clock, on Robinhood Chain, inside limits their own account enforces. It decides only WHEN to move, never what to own, and fingerprints every decision on-chain. Link your workspace to your agent with a code from the website (send: link ABC123), then ask it how your portfolio is doing, why it waited, or to check now. Anything that moves money comes back as a link to confirm on your agent’s page.'

/** Our own workflow's goal and task, as provisioned. Only a task that carries both runs the review pass. */
// Word for word what the platform's workflow holds: `doTask` recognises its own hourly run by it. It still says
// "desk" for the same reason the workflow name does; renaming it here alone made every hourly run a chat question.
export const HOURLY_GOAL =
  'Every hour, check each running desk against its owner mandate and act only within the limits that desk enforces on-chain.'
export const HOURLY_TASK = 'Run the hourly desk review'

/**
 * A workspace's lasting key. The platform sends a fresh `workspace.id` on every run (it names the session), but the
 * workspace's file bucket stays the same, so links are kept against that.
 */
const workspaceKey = (w: { id: number | string; bucket_folder?: string }) => w.bucket_folder || String(w.id)

/** What the platform calls a workspace, for "Linked to X". Its payload types only the goal, so a name is a bonus. */
export const workspaceLabel = (w: { goal?: string; name?: unknown }) =>
  (typeof w.name === 'string' && w.name.trim()) || w.goal?.trim().slice(0, 120) || null

/** The session a capability call came from. A call with no workspace is refused by every capability. */
export function callerSession(action: ActionSchema | undefined): CallerSession {
  const workspace = action?.workspace
  return {
    workspaceKey: workspace ? workspaceKey(workspace) : '',
    taskId: action?.type === 'do-task' ? String(action.task.id) : null,
    executionId:
      action?.type === 'do-task' && action.workspaceExecutionId !== undefined
        ? String(action.workspaceExecutionId)
        : null,
  }
}

/** A workspace task that only asks for a check: "check now", "please check my desk". */
const CHECK_TASK = /^\s*(please\s+)?check(\s+(it|my desk|the desk))?(\s+now)?[.!]?\s*$/i

/** How long check_now waits for its decision before answering with the link alone. */
const CHECK_WAIT_MS = 50_000

export interface AgentCredentials {
  /** Identifies this agent to the platform. */
  apiKey: string
  /** Validates that an incoming request really came from the platform. */
  authToken: string
}

export function createDeskAgent(cli: Cli, log: Log, credentials?: AgentCredentials): Agent {
  const review = async (trigger: string, session: CallerSession) => {
    log('openserv_task', { trigger, task: session.taskId, execution: session.executionId })
    // The same pass the timer runs, never beside it: one operator key, one pass at a time. The workflow's task
    // and run are stamped on every decision its hourly checks write.
    const summary = await reviewAllDesksExclusive(cli, log, {
      trigger: 'cron',
      openserv: { workspace: session.workspaceKey, taskId: session.taskId, executionId: session.executionId },
    })
    return summary
  }

  /** Queues the check, then waits for the worker's pass to run it, so the answer carries the decision. */
  const checkNowAndWait = async (session: CallerSession): Promise<string> => {
    const asked = await checkNow(cli, log, session)
    if (!asked.ok || !asked.requestId) return asked.reply
    const until = Date.now() + CHECK_WAIT_MS
    while (Date.now() < until) {
      await new Promise((r) => setTimeout(r, 2_000))
      const status = await checkRequestStatus(cli.db, asked.requestId)
      if (status?.status === 'refused') return status.refusedReason ?? asked.reply
      if (status?.status === 'done') return `${asked.reply}\n\n${await latestDecisions(cli, session, 3)}`
    }
    return asked.reply
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
        const reply = await answerWorkspace(
          cli,
          log,
          workspaceKey(action.workspace),
          last.message,
          workspaceLabel(action.workspace),
        )
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
          // "Check now" as a task is the check_now capability, with this task's id on the decision it writes.
          const answer = CHECK_TASK.test(question)
            ? await checkNowAndWait(callerSession(action))
            : await answerWorkspace(
                cli,
                log,
                workspaceKey(action.workspace),
                question,
                workspaceLabel(action.workspace),
              )
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
        const summary = await review(action.task.triggerEvent?.trigger_name ?? 'task', callerSession(action))
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
      'You are the after-hours agent. You do not decide anything here: your engine does, inside on-chain limits.',
    // Registering binds these itself. Starting later reads them back from the saved state.
    ...(credentials ?? {}),
  })

  // The public one READS: the hourly review is started by the workflow's cron trigger and by nothing a chat can
  // say, so a stray request can never add a third clock. The one way to ask for a check is check_now below,
  // from a linked workspace whose owner allowed it, and it runs one desk's check inside the same pass.
  agent.addCapability({
    name: 'desk_status',
    description:
      'Say how many agents are running and when the worker last completed a pass. Reads only; it never starts a check.',
    schema: z.object({
      reason: z.string().optional().describe('Why this was asked. Recorded, never acted on.'),
    }),
    async run({ args }) {
      log('openserv_capability', { reason: args.reason ?? null })
      const [desks, beat] = await Promise.all([runningDesks(cli.db), workerBeat(cli.db)])
      return `${desks.length} agent${desks.length === 1 ? '' : 's'} running. The worker's last pass finished ${beat ? beat.beatAt.toISOString() : 'never'}. Checks run on the hourly trigger, not on request.`
    },
  })

  // Callable only from a workspace linked to a desk. Each finds the desk through that link and nothing else.
  agent.addCapability({
    name: 'agent_status',
    description:
      'The linked Shijima agent: its name, practice or live, running or paused, and when it last checked. Only for a workspace linked to an agent with "link <code>".',
    inputSchema: z.object({}),
    async run({ action }) {
      return agentStatus(cli, callerSession(action))
    },
  })

  agent.addCapability({
    name: 'latest_decisions',
    description:
      'The linked agent’s newest decisions, including "nothing to do": what it decided, the amount, the transaction and a link to the full record.',
    inputSchema: z.object({
      limit: z.number().int().min(1).max(20).optional().describe('How many, newest first. Default 5.'),
    }),
    async run({ args, action }) {
      return latestDecisions(cli, callerSession(action), args.limit ?? 5)
    },
  })

  agent.addCapability({
    name: 'check_now',
    description:
      'Ask the linked agent to look now instead of at the next hour. Only works when the owner turned on "Let my workspace trigger checks". The agent’s own rules and the on-chain limits still decide whether anything moves; it can never withdraw or raise a limit.',
    inputSchema: z.object({
      reason: z.string().max(300).optional().describe('Why a check is wanted. Recorded, never acted on.'),
    }),
    async run({ args, action }) {
      log('openserv_capability', { name: 'check_now', reason: args.reason ?? null })
      return checkNowAndWait(callerSession(action))
    },
  })

  agent.addCapability({
    name: 'propose_change',
    description:
      'Suggest a change to the linked agent in plain words, for example "hold less NVDA". Nothing changes here: the answer is a link where the owner confirms it on the website.',
    inputSchema: z.object({
      change: z.string().min(3).max(1000).describe('The change, in plain words.'),
    }),
    async run({ args, action }) {
      return proposeChange(cli, log, callerSession(action), args.change)
    },
  })

  return agent
}

function summarise(s: ReviewSummary): string {
  if (s.held) return 'Held: an earlier transaction may still land, so nothing new was sent.'
  const checks = s.checks.map((c) => `${c.desk} ${c.status} (${c.records} records)`).join(', ')
  return [
    `${s.desks} agent${s.desks === 1 ? '' : 's'} reviewed.`,
    s.checks.length > 0 ? `Checked: ${checks}.` : 'Every agent had already been checked this hour.',
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

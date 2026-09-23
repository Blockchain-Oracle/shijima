/**
 * Shijima inside someone's OpenServ workspace. The platform names the workspace, never the person, so a workspace
 * is tied to one desk by a one-time code the owner makes on the website ("link ABC123"). After that, its chat and
 * the tasks it assigns reach the same brain as the website's chat and the Telegram bot: `core/ask`, answering from
 * the desk's own record, and proposing a change only as a card the owner confirms on the website.
 *
 * Nothing here trades or signs. A question becomes an `ask_requests` row, which the worker's chat loop answers.
 */
import {
  askAllowed,
  askRequestForOwner,
  claimOpenservLink,
  createAskRequest,
  deskById,
  deskForWorkspace,
} from '@desk/db'
import { openservCopy as C, errorText } from '@desk/shared'
import type { Cli, Log } from '../review'

const LINK = /^\s*link\s+([A-Za-z0-9-]{4,40})\s*$/i
const WAIT_MS = 60_000
const POLL_MS = 1_000

const siteOf = (cli: Cli) => cli.env.SITE_URL ?? 'http://localhost:3007'
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

interface AskAnswer {
  reply: string
  refused?: string | null
}

/** One message from a workspace, answered in words. Links the workspace when the message is a code. */
export async function answerWorkspace(
  cli: Cli,
  log: Log,
  workspaceId: string,
  text: string,
  workspaceName?: string | null,
): Promise<string> {
  const site = siteOf(cli)
  // A task arrives with its description and its body, often the same words twice, so the text is read line by
  // line: a line "link ABC123" links the workspace, and whatever else was written is the question.
  const lines = [
    ...new Set(
      text
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean),
    ),
  ]
  const codeLine = lines.find((l) => LINK.test(l))
  const question = lines.filter((l) => !LINK.test(l)).join('\n')
  if (codeLine) {
    const code = LINK.exec(codeLine)?.[1] ?? ''
    const claim = await claimOpenservLink(cli.db, code.toUpperCase(), workspaceId, workspaceName)
    const already = !claim.ok && (await deskForWorkspace(cli.db, workspaceId))
    if (!claim.ok && !already) return claim.reason === 'another_desk' ? C.linkElsewhere : C.linkUsed
    if (claim.ok) {
      const desk = await deskById(cli.db, claim.deskId)
      log('openserv_linked', { workspace: workspaceId, desk: desk?.address })
      const url = `${site}/agents/${desk?.shareSlug ?? claim.deskId}`
      if (!question) return C.linked(desk?.name ?? 'your agent', url)
    }
  }
  if (!question) {
    const ws = await deskForWorkspace(cli.db, workspaceId)
    return ws
      ? C.linked(ws.name ?? 'your agent', `${site}/agents/${ws.shareSlug ?? ws.deskId}`)
      : C.notLinked(site)
  }

  const linked = await deskForWorkspace(cli.db, workspaceId)
  if (!linked) return C.notLinked(site)
  if (linked.lifecycle === 'closed') return C.closed
  const desk = await deskById(cli.db, linked.deskId)
  if (!desk) return C.notLinked(site)
  const allowed = await askAllowed(cli.db, desk.ownerAddress)
  if (!allowed.ok) return C.slowDown

  const path = `${site}/agents/${linked.shareSlug ?? linked.deskId}`
  try {
    const id = await createAskRequest(cli.db, {
      ownerAddress: desk.ownerAddress,
      deskId: desk.id,
      kind: 'ask',
      via: 'openserv',
      question: question.slice(0, 1000),
      payload: { openservWorkspaceId: workspaceId },
    })
    // The chat loop hears the NOTIFY and answers in six to ten seconds. Wait for it here: the platform shows
    // whatever this returns as the agent's reply.
    const until = Date.now() + WAIT_MS
    while (Date.now() < until) {
      await sleep(POLL_MS)
      const row = await askRequestForOwner(cli.db, id, desk.ownerAddress)
      if (!row || row.status === 'pending' || row.status === 'claimed') continue
      if (row.status === 'failed' || !row.reply) return row.error ?? C.failed
      const answer = row.reply as unknown as AskAnswer
      const body =
        answer.refused && answer.refused !== answer.reply
          ? `${answer.reply}\n\n${answer.refused}`
          : answer.reply
      // A card that would change the desk is confirmed on the website, never from the platform.
      return row.proposal?.status === 'open'
        ? `${body}\n\n${C.confirm(`${path}?proposal=${row.proposal.id}`)}`
        : body
    }
    return C.timeout
  } catch (e) {
    log('openserv_answer_failed', { workspace: workspaceId, error: errorText(e) })
    return C.failed
  }
}

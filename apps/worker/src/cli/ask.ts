/**
 * Talk to the dev desk from the terminal, through exactly the path the website and Telegram use.
 *
 *   pnpm desk:ask "why did you wait?"      write the message, let the chat loop answer it, print the answer
 *   pnpm desk:ask --dry "…"                print what the desk would be told, and call nothing
 *   pnpm desk:ask --confirm <proposal id>  the owner's yes to a card the sign-in session may confirm
 *
 * It starts the chat loop in this process, so it needs no worker running. The message goes in as a row with a
 * NOTIFY, exactly as the website sends it, and the answer comes back through the same row.
 */
import { APPROVED_TOKENS } from '@desk/chain'
import { confirmSigninProposal, loadAskContext } from '@desk/core'
import { askRequestForOwner, createAskRequest, deskById, findDeskByAddress } from '@desk/db'
import { errorText } from '@desk/shared'
import { startAskLoop } from '../ask'
import { currentDeployment, openCli } from './context'

const args = process.argv.slice(2)
const dry = args.includes('--dry')
const confirmAt = args.indexOf('--confirm')
const question = args
  .filter((a) => !a.startsWith('--'))
  .join(' ')
  .trim()

const cli = await openCli()
try {
  const desk = await findDeskByAddress(cli.db, currentDeployment().devDesk)
  if (!desk) throw new Error('the dev desk is not registered. Run: pnpm desk:wake')
  const owner = (await deskById(cli.db, desk.id))?.ownerAddress
  if (!owner) throw new Error('the dev desk has no owner')

  if (confirmAt !== -1) {
    const proposalId = args[confirmAt + 1]
    if (!proposalId) throw new Error('give the proposal id: pnpm desk:ask --confirm <id>')
    const outcome = await confirmSigninProposal(cli.db, APPROVED_TOKENS, {
      proposalId,
      ownerAddress: owner,
      via: 'web',
    })
    console.log(`${outcome.ok ? 'DONE' : 'REFUSED'}: ${outcome.text}`)
  } else if (!question) {
    throw new Error('write a message: pnpm desk:ask "how is my desk doing?"')
  } else if (dry) {
    const context = await loadAskContext(cli.db, {
      deskId: desk.id,
      ownerAddress: owner,
      question,
      approved: APPROVED_TOKENS,
      now: new Date(),
    })
    console.log('refused' in context ? `REFUSED: ${context.refused}` : context.message)
  } else {
    const loop = await startAskLoop(cli, (event, detail = {}) =>
      console.log(JSON.stringify({ event, ...detail })),
    )
    const id = await createAskRequest(cli.db, {
      ownerAddress: owner,
      deskId: desk.id,
      kind: 'ask',
      via: 'chat',
      question,
    })
    const started = Date.now()
    let row = await askRequestForOwner(cli.db, id, owner)
    while (row && (row.status === 'pending' || row.status === 'claimed') && Date.now() - started < 60_000) {
      await new Promise((r) => setTimeout(r, 250))
      row = await askRequestForOwner(cli.db, id, owner)
    }
    await loop.stop()
    console.log(JSON.stringify({ status: row?.status, error: row?.error, reply: row?.reply }, null, 2))
    if (row?.proposal) console.log(JSON.stringify({ proposal: row.proposal }, null, 2))
  }
} catch (e) {
  console.error(errorText(e))
  process.exitCode = 1
} finally {
  await cli.close()
}

/**
 *   pnpm openserv:provision          register the agent and its hourly workflow on OpenServ
 *   pnpm openserv:provision --show   what is registered already, from the local state file
 *
 * Idempotent: with `.openserv.json` present it UPDATES the same agent, and without it it creates a new one.
 * That file holds live credentials, so it is gitignored and must never be committed or copied.
 *
 * Identity: `OPENSERV_USER_API_KEY` registers the agent under that OpenServ account, which is what judges will
 * look at. Without it the client falls back to signing in with a wallet, which creates a SEPARATE account owned
 * by that wallet. This command refuses to guess: it asks for the key rather than quietly making a new identity.
 */

import { errorText } from '@desk/shared'
import { getProvisionedInfo, provision, triggers } from '@openserv-labs/client'
import { openCli } from '../cli/context'
import { AGENT_DESCRIPTION, AGENT_NAME, createDeskAgent, HOURLY_GOAL, HOURLY_TASK } from './agent'

const WORKFLOW_NAME = 'Hourly desk review'
const log = (event: string, detail: Record<string, unknown> = {}) =>
  console.log(JSON.stringify({ at: new Date().toISOString(), event, ...detail }))

if (process.argv.includes('--show')) {
  const info = getProvisionedInfo(AGENT_NAME, WORKFLOW_NAME)
  console.log(info ? JSON.stringify(info, null, 2) : 'nothing is registered yet from this machine')
  process.exit(0)
}

const userApiKey = process.env.OPENSERV_USER_API_KEY
if (!userApiKey) {
  console.error(
    [
      'OPENSERV_USER_API_KEY is missing.',
      '',
      'Get it from https://platform.openserv.ai (Developer, then API key) and put it in .env.',
      'Without it this would sign in with a wallet and create a SEPARATE OpenServ account, which is not',
      'the one anyone will be looking at. So it stops here rather than making an identity nobody asked for.',
    ].join('\n'),
  )
  process.exit(1)
}

const cli = await openCli()
try {
  const agent = createDeskAgent(cli, log)
  const result = await provision({
    userApiKey,
    agent: {
      instance: agent,
      name: AGENT_NAME,
      description: AGENT_DESCRIPTION,
      // Only set when this process is reachable at a public address of its own. Left out, the SDK routes
      // through OpenServ's proxy when the agent starts.
      ...(process.env.AGENT_ENDPOINT_URL ? { endpointUrl: process.env.AGENT_ENDPOINT_URL } : {}),
    },
    workflow: {
      name: WORKFLOW_NAME,
      goal: HOURLY_GOAL,
      // The platform is the clock. The worker's own timer is the safety net behind it, and a check is keyed
      // on its hour, so whichever arrives first does the work.
      trigger: triggers.cron({ schedule: '0 * * * *', timezone: 'UTC' }),
      task: {
        description: HOURLY_TASK,
        body: 'Check every running desk once. Record every decision, including doing nothing.',
      },
    },
  })
  console.log(JSON.stringify(result, null, 2))
  console.log('\nregistered. `.openserv.json` now holds the credentials: it is gitignored, keep it that way.')
} catch (e) {
  console.error(errorText(e))
  process.exitCode = 1
} finally {
  await cli.close()
}

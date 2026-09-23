/**
 * Where Shijima lives on OpenServ, for pages that link to it. Public ids, no credentials: those stay in the
 * worker's gitignored `.openserv.json`. Set by `pnpm openserv:provision` and `pnpm openserv:identity`.
 */
export const OPENSERV = {
  agentId: 4513,
  workflowId: 13895,
  agentUrl: 'https://platform.openserv.ai/agents/4513',
  /** ERC-8004 identity on Base, owned by the deployer wallet. */
  identity: { chainId: 8453, tokenId: 95396, url: 'https://www.8004scan.io/agents/base/95396' },
} as const

/**
 * What the agent says inside an OpenServ workspace. A workspace is tied to one desk by a one-time code from the
 * website; after that its chat and its tasks reach the same brain as the website and Telegram.
 */
export const openservCopy = {
  notLinked: (site: string) =>
    `I am Shijima, an AI agent that looks after one person's Stock Tokens on Robinhood Chain. This workspace is not linked to a desk yet. On ${site}, open your desk's Settings, choose Connections, make an OpenServ code, and send it here as: link ABC123`,
  linked: (name: string, url: string) =>
    `Linked. This workspace now talks to ${name}. Ask me how it is doing, why I waited, or to check now. Anything that moves money comes back as a link to confirm on your desk: ${url}`,
  linkUsed:
    'That code has expired or was already used. Make a new one in your desk’s Settings, under Connections.',
  linkElsewhere: 'This workspace is already linked to another desk. Unlink it there first.',
  closed: 'The desk this workspace is linked to is closed. Its record stays readable on the website.',
  slowDown:
    'That is a lot of questions for today. I answer again tomorrow; the desk keeps working meanwhile.',
  failed: 'I could not answer just now. Nothing was changed.',
  timeout: 'I am still thinking about that. The answer will be in the chat on your desk.',
  confirm: (url: string) => `Nothing changes until you confirm it on your desk: ${url}`,
  task: (answer: string) => answer,
  /** The owner has not turned on "Let my workspace trigger checks" for this workspace. */
  checksOff: (url: string) =>
    `This workspace may read the desk but not start checks. The owner can allow it in Settings, under Connections: ${url}`,
  checkQueued: (url: string) =>
    `Asked. The agent looks now, and its usual rules and on-chain limits still decide whether anything moves. The decision will be on the desk: ${url}`,
  checkRefused: {
    pending: 'A check is already waiting to run. Its decision will be on the desk in a minute.',
    cooldown: 'The desk was checked less than ten minutes ago. Ask again a little later.',
    not_running: 'The desk is not running, so there is nothing to check.',
  },
} as const

/**
 * An OpenServ webhook-trigger URL, exactly: `https://api.openserv.ai/webhooks/trigger/<token>`. Anything else is
 * refused, so a saved "webhook" can never make the worker POST to an arbitrary host. Returns the token.
 */
export function openservWebhookToken(url: string): string | undefined {
  const m = /^https:\/\/api\.openserv\.ai\/webhooks\/trigger\/([A-Za-z0-9_-]{8,200})\/?$/.exec(url.trim())
  return m?.[1]
}

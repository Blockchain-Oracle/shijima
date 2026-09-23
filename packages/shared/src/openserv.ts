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
} as const

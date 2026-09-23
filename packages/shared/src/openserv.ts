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

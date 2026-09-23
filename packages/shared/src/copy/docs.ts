/**
 * `/docs`: the manual. Users first (start, the agent, safety, connecting), then builders (how it is made, the
 * contract, the record, OpenServ, running it). Every fact here is checkable in the code or on the chain.
 */
export type DocBlock =
  | { p: string }
  | { list: readonly string[] }
  | { steps: readonly string[] }
  | { code: string }
  | { rows: readonly (readonly [string, string])[] }
  | { note: string }

export interface DocSection {
  id: string
  group: 'Use it' | 'Build on it'
  title: string
  blocks: readonly DocBlock[]
}

export const docsCopy = {
  title: 'Docs',
  lead: 'Everything Shijima does, how to use it, and how it is built. Users first, builders after.',
  onThisPage: 'On this page',
  groups: ['Use it', 'Build on it'] as const,
  sections: [
    {
      id: 'what',
      group: 'Use it',
      title: 'What Shijima is',
      blocks: [
        {
          p: 'Shijima is an AI agent that looks after a basket of US Stock Tokens for you on Robinhood Chain. You put in USDG, pick a strategy, and it keeps your money on that plan around the clock, including the nights and weekends when New York is shut and nobody else is watching.',
        },
        {
          p: 'It decides only when to move toward your plan: now, in part, after New York reopens, or not at all. It never picks what to own, never predicts a price, and can never send your money anywhere but back to you.',
        },
        {
          rows: [
            ['You put in', 'USDG, a digital dollar, from $5'],
            ['You choose', 'A strategy: a basket of US stocks at target weights, plus cash'],
            ['Your agent', 'Watches every five minutes and wakes when something moves'],
            ['You see', 'Your portfolio, and every decision with its reasons'],
            ['You are told', 'On Telegram, when it acts or needs you'],
          ],
        },
      ],
    },
    {
      id: 'start',
      group: 'Use it',
      title: 'Getting started',
      blocks: [
        {
          steps: [
            'Connect a wallet on Robinhood Chain and sign one message. Signing costs nothing.',
            'Pick a strategy: The 7 giants, the whole US market, the companies building AI, or your own mix.',
            'Choose how much USDG to put in. You see what that amount buys of each stock, in dollars. You can also start in practice with no money.',
            'Set your agent’s limits: the most per trade, the most per day, and the loss at which everything stops.',
            'Meet your agent, read the one-page disclosure, and confirm. Your wallet signs twice: once to create your account, once to put in your USDG.',
            'Connect Telegram so your agent can reach you.',
          ],
        },
        {
          p: 'Your USDG on another network? Bring it from Base, Arbitrum, Ethereum or BNB Chain in one step at the last screen. Crossing networks has a fixed fee, so it works best from $20.',
        },
      ],
    },
    {
      id: 'agent',
      group: 'Use it',
      title: 'What your agent does',
      blocks: [
        {
          p: 'Every five minutes it looks at your account and the market. Most looks find nothing to do, and those write nothing. It wakes the AI only when something moves:',
        },
        {
          list: [
            'a holding drifts from its target by more than you allow',
            'the price gap to the last official price moves by 1%',
            'money arrives in your account',
            'one of your rules fires, such as “sell half of Nvidia if it falls 3%”',
            'a new headline names a company you hold',
            'you answer a request, or ask it to check now',
          ],
        },
        {
          p: 'Arithmetic finds what would move you back to plan. Code refuses anything a hard rule forbids. The AI answers one question, when, with its confidence, its reasons and the options it turned down. Code then checks your limits again, and your account on the chain refuses anything over them.',
        },
        {
          p: 'Every decision is written down, including the ones where it chose to wait. On a quiet day it writes one line that it looked and found nothing to do. After New York reopens, each decision is graded against the alternative it really had.',
        },
      ],
    },
    {
      id: 'modes',
      group: 'Use it',
      title: 'Practice, ask first, on its own',
      blocks: [
        {
          rows: [
            ['Practice', 'Decides for real and spends nothing. Every desk starts here.'],
            ['Ask me first', 'Asks you before each action, in Telegram or on the website.'],
            ['On its own', 'Acts inside your limits, and still asks for large actions.'],
          ],
        },
        {
          p: 'Going live is earned: a day of practice and its report read. You choose when.',
        },
      ],
    },
    {
      id: 'safety',
      group: 'Use it',
      title: 'Your money and its safety',
      blocks: [
        {
          list: [
            'It is your account: a small contract of your own on Robinhood Chain. Only your wallet can take money out, and only to itself.',
            'Your limits are enforced by the chain itself: the most per trade, the most per day, and a price floor 8% from the official price.',
            'Idle cash earns interest in the Steakhouse USDG savings vault on Morpho, the vault Robinhood Earn uses. It is taken back out when a buy needs it.',
            'You can pause, take everything out, or remove the agent, each in one step.',
          ],
        },
        {
          note: 'The honest worst case: the agent can never send your funds anywhere. If its key were stolen, the thief could only make bad trades, costing at most 8% of your daily limit in each 24-hour window, until you remove it.',
        },
        {
          p: 'If this website ever disappears, your money is still yours: open your desk on the Blockscout explorer, choose Write proxy, connect your wallet and call withdraw.',
        },
      ],
    },
    {
      id: 'connect',
      group: 'Use it',
      title: 'Telegram, OpenServ and your phone',
      blocks: [
        {
          p: 'Telegram: press Connect Telegram on your desk and the bot opens already linked. It keeps one pinned status message, sends a message when it acts or needs you, and answers anything you ask.',
        },
        {
          p: 'OpenServ: add the Shijima agent to your own OpenServ workspace. On your desk, open Settings, then Connections, and make a link code. Send it to Shijima in the workspace. From then on you can ask it anything there, in chat or as a task. Anything that moves money comes back as a link to confirm on your desk.',
        },
        { code: 'link ABC12345\nHow is my portfolio doing?\nWhy did you wait on Nvidia?\nCheck now' },
        {
          p: 'Your phone: open Shijima in your phone’s browser and add it to your home screen. It opens full screen, like an app.',
        },
      ],
    },
    {
      id: 'architecture',
      group: 'Build on it',
      title: 'How it is built',
      blocks: [
        {
          rows: [
            ['Desk contract', 'Solidity, one EIP-1167 clone per owner, Foundry'],
            ['Worker', 'Node: the watch loop, the engine, the chat, the Telegram bot and the OpenServ agent'],
            ['Engine', 'TypeScript: reconcile, value, needs, pre-gate, SERV timing, gate, commit, record'],
            ['Reasoning', 'SERV Reasoning, one strict JSON question per decision and per chat message'],
            ['Web', 'Next.js 16, server-rendered from Postgres; it never holds a key and never trades'],
            ['Data', 'Postgres with Drizzle; every record hash-chained under an advisory lock'],
          ],
        },
        {
          p: 'The website writes requests into the database, and the worker, the only process with keys, carries them out. A chat card is confirmed by the owner and runs through the same checks as the engine.',
        },
      ],
    },
    {
      id: 'contract',
      group: 'Build on it',
      title: 'The desk contract',
      blocks: [
        {
          rows: [
            ['Chain', 'Robinhood Chain mainnet, 4663'],
            ['Factory', '0xB0Df8d1ca6eDA2700a2D145bab2675109A2e89f1'],
            ['Implementation', '0x90ff69C78014d06e3f09DC0985E83Cd8338aFe0F (verified on Blockscout)'],
            ['Live desk', '0xC61DDE99B72add803E47B1bcA17B4bf8819618B1'],
          ],
        },
        {
          list: [
            'Operator (the agent): buy, sell, sweepToVault, redeemFromVault, checkpoint, pause. Each capped per action and per day, on the owner’s pinned pool, inside 8% of the Chainlink price.',
            'Owner: withdraw (to the owner only), unpause, setLimits, allowToken, setOperator, revokeOperator, batch.',
            'Session key (optional, up to 7 days): withdraw to the owner, pause, revoke the operator, lower limits, capped sells.',
            'Every action carries a decision hash; the contract keeps seq and a hash chain head.',
          ],
        },
      ],
    },
    {
      id: 'record',
      group: 'Build on it',
      title: 'The record and Check it',
      blocks: [
        {
          p: 'Each decision is a JSON record (schema version 2) with the evidence the agent saw, the AI’s answer, the limits check and the outcome. It is serialised with RFC 8785 canonical JSON and hashed with keccak256. The previous record’s hash is inside each record, so the records form a chain.',
        },
        {
          p: 'An action writes its record’s hash on the chain in the same transaction. A decision with no action is sealed by the next action or the daily checkpoint. Check it, on every decision page, rebuilds the bytes in your browser, asks the public RPC for the transaction and compares the fingerprints.',
        },
        { code: 'keccak256(canonicalJson(record)) == decisionHash in the Desk event' },
      ],
    },
    {
      id: 'openserv',
      group: 'Build on it',
      title: 'On OpenServ',
      blocks: [
        {
          rows: [
            ['Agent', 'shijima, id 4513, external and self hosted'],
            ['Workflow', 'Hourly desk review (13895), cron at the top of every hour'],
            ['Identity', 'ERC-8004 on Base, token 95396'],
            ['Reasoning', 'SERV Reasoning on every timing decision and chat answer'],
          ],
        },
        {
          p: 'The agent overrides doTask and respondToChat so its own engine answers, never the platform’s model. Our workflow’s task runs the watch pass; a task or chat from any other workspace is answered for the desk that workspace was linked to.',
        },
      ],
    },
    {
      id: 'run',
      group: 'Build on it',
      title: 'Run it yourself',
      blocks: [
        {
          code: 'pnpm install\npnpm --filter @desk/db migrate\npnpm worker:start        # the agent: watch loop, chat, Telegram, OpenServ\npnpm --filter web dev    # the website on :3007\npnpm desk:review         # one pass of the worker, by hand',
        },
        {
          p: 'Rehearse anything that moves money on a local fork first: start anvil forked from mainnet, run pnpm rehearsal:reset, and set RPC_URL=http://127.0.0.1:8545. The worker then refuses the live database.',
        },
      ],
    },
  ] satisfies readonly DocSection[],
} as const

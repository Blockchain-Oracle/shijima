import type { Diagram } from './diagram-types';

/**
 * Every box and arrow here is checked against the code (see each page's source notes). Coordinates are in the
 * diagram's own units; the renderer scales the whole picture, text included.
 */
export const diagrams = {
  system: {
    kicker: 'System map',
    title: 'Where each part runs',
    subtitle: 'The website only reads and writes requests. The worker holds the operator key and is the only part that sends a transaction.',
    note: 'Solid arrows do something or write something. Dashed arrows only read. Money never passes through the website or the worker: it moves between your wallet, your own agent account and the pools.',
    width: 900,
    height: 690,
    groups: [
      { label: 'Coolify server', x: 262, y: 44, w: 236, h: 586 },
      { label: 'Robinhood Chain · 4663', x: 568, y: 44, w: 318, h: 586 },
    ],
    nodes: [
      { id: 'you', title: 'You + your wallet', sub: ['any browser wallet', 'or WalletConnect'], x: 24, y: 96, w: 196, h: 78, tone: 'accent' },
      { id: 'relay', title: 'Relay', sub: ['Base · Arbitrum', 'Ethereum · BNB Chain'], x: 24, y: 224, w: 196, h: 70, logo: 'relay' },
      { id: 'telegram', title: 'Telegram', sub: ['status · alerts', 'approvals'], x: 24, y: 346, w: 196, h: 70, logo: 'telegram' },
      { id: 'openserv', title: 'OpenServ', sub: ['agent 4513', 'hourly workflow'], x: 24, y: 450, w: 196, h: 70, logo: 'openserv' },
      { id: 'serv', title: 'SERV Reasoning', sub: ['one timing question'], x: 24, y: 556, w: 196, h: 62, logo: 'openserv' },

      { id: 'web', title: 'Web app', sub: ['Next.js 16', 'holds no key'], x: 280, y: 96, w: 200, h: 78 },
      { id: 'db', title: 'Postgres 16', sub: ['records · requests', 'outbox · money moves'], x: 280, y: 290, w: 200, h: 78 },
      { id: 'worker', title: 'Worker', sub: ['engine · write-ahead sender', 'OpenServ agent', 'Telegram bot · gift sender', 'holds the operator key'], x: 280, y: 440, w: 200, h: 130, tone: 'accent' },

      { id: 'factory', title: 'DeskFactory', sub: ['one clone per owner'], x: 586, y: 96, w: 282, h: 62, logo: 'robinhood' },
      { id: 'desk', title: 'Your Desk contract', sub: ['your money · your limits', 'pays only you'], x: 586, y: 200, w: 282, h: 82, tone: 'accent' },
      { id: 'uniswap', title: 'Uniswap v3', sub: ['one pinned pool per token'], x: 632, y: 330, w: 236, h: 62, logo: 'uniswap' },
      { id: 'chainlink', title: 'Chainlink feeds', sub: ['price floor: 8% band'], x: 632, y: 434, w: 236, h: 62, logo: 'chainlink' },
      { id: 'morpho', title: 'Morpho vault', sub: ['Steakhouse USDG, idle cash'], x: 632, y: 538, w: 236, h: 62, logo: 'morpho' },
    ],
    edges: [
      { from: 'you', to: 'web', label: 'reads', kind: 'read', labelAt: [250, 122] },
      { from: 'you', to: 'factory', label: 'create your agent', kind: 'action', points: [[122, 96], [122, 22], [548, 22], [548, 127], [586, 127]], labelAt: [335, 22] },
      { from: 'you', to: 'desk', label: 'fund · withdraw', kind: 'money', points: [[180, 174], [180, 206], [540, 206], [540, 244], [586, 244]], labelAt: [300, 206] },
      { from: 'you', to: 'relay', label: '', kind: 'money', points: [[70, 174], [70, 224]] },
      { from: 'relay', to: 'desk', label: 'USDG from other chains', kind: 'money', points: [[220, 266], [252, 266], [252, 232], [586, 232]], labelAt: [470, 232] },
      { from: 'web', to: 'db', label: 'requests', kind: 'action', labelAt: [380, 266] },
      { from: 'worker', to: 'db', label: 'records · results', kind: 'action', labelAt: [380, 404] },
      { from: 'openserv', to: 'worker', label: 'hourly task', kind: 'action', points: [[220, 485], [280, 485]], labelAt: [250, 471] },
      { from: 'worker', to: 'serv', label: 'when?', kind: 'action', points: [[280, 545], [246, 545], [246, 587], [220, 587]], labelAt: [246, 566] },
      { from: 'worker', to: 'telegram', label: 'messages', kind: 'action', points: [[280, 460], [246, 460], [246, 381], [220, 381]], labelAt: [246, 420] },
      { from: 'worker', to: 'desk', label: 'trades · seals', kind: 'action', points: [[480, 490], [524, 490], [524, 270], [586, 270]], labelAt: [524, 420] },
      { from: 'desk', to: 'uniswap', label: '', kind: 'action', points: [[606, 282], [606, 361], [632, 361]] },
      { from: 'desk', to: 'chainlink', label: '', kind: 'read', points: [[868, 262], [880, 262], [880, 465], [868, 465]] },
      { from: 'desk', to: 'morpho', label: '', kind: 'money', points: [[606, 282], [606, 569], [632, 569]] },
    ],
  },

  money: {
    kicker: 'Money flow',
    title: 'Where your money can go',
    subtitle: 'In from your wallet, round the pools and the savings vault, and out only to your wallet.',
    note: 'Every trade and vault move sends its output back to your agent account. Withdraw is the only way out, and the contract pays it to the owner and nobody else.',
    width: 900,
    height: 430,
    nodes: [
      { id: 'chains', title: 'Other chains', sub: ['Base · Arbitrum', 'Ethereum · BNB, via Relay'], x: 24, y: 40, w: 206, h: 74, logo: 'relay' },
      { id: 'wallet', title: 'Your wallet', sub: ['the only way out', 'leads here'], x: 24, y: 190, w: 206, h: 84, tone: 'accent' },
      { id: 'operator', title: 'Operator key', sub: ['Shijima trades for you'], x: 344, y: 28, w: 212, h: 66, tone: 'quiet' },
      { id: 'desk', title: 'Your agent account', sub: ['a Desk contract you own', 'USDG · Stock Tokens'], x: 344, y: 172, w: 212, h: 104, tone: 'accent' },
      { id: 'uniswap', title: 'Uniswap v3', sub: ['USDG ⇄ Stock Tokens'], x: 670, y: 108, w: 206, h: 66, logo: 'uniswap' },
      { id: 'morpho', title: 'Morpho vault', sub: ['idle cash earns'], x: 670, y: 236, w: 206, h: 66, logo: 'morpho' },
      { id: 'others', title: 'Anyone else', sub: ['Shijima included'], x: 344, y: 350, w: 212, h: 60, tone: 'quiet' },
    ],
    edges: [
      { from: 'chains', to: 'wallet', label: 'bridge in', kind: 'money' },
      { from: 'wallet', to: 'desk', label: 'fund', kind: 'money', points: [[230, 206], [344, 206]], labelAt: [287, 206] },
      { from: 'desk', to: 'wallet', label: 'withdraw', kind: 'money', points: [[344, 256], [230, 256]], labelAt: [287, 256] },
      { from: 'chains', to: 'desk', label: 'or straight in', kind: 'money', points: [[230, 70], [300, 70], [300, 188], [344, 188]], labelAt: [300, 124] },
      { from: 'operator', to: 'desk', label: 'trade inside limits', kind: 'read' },
      { from: 'desk', to: 'uniswap', label: 'buy · sell', kind: 'money', points: [[556, 200], [612, 200], [612, 141], [670, 141]], labelAt: [612, 172] },
      { from: 'desk', to: 'morpho', label: 'sweep · redeem', kind: 'money', points: [[556, 252], [612, 252], [612, 269], [670, 269]], labelAt: [612, 290] },
      { from: 'desk', to: 'others', label: 'never', kind: 'never' },
    ],
  },

  openserv: {
    kicker: 'OpenServ',
    title: 'How Shijima sits on OpenServ',
    subtitle: 'OpenServ hosts the agent and wakes it every hour. Shijima runs its own engine; the platform model never decides.',
    note: 'The hourly workflow is the main clock. The worker keeps its own timer as a safety net, and a check is keyed to its time slot, so whichever clock arrives first does the work and the other finds it done.',
    width: 900,
    height: 420,
    nodes: [
      { id: 'platform', title: 'OpenServ platform', sub: ['lists agent 4513', 'runs workflows'], x: 24, y: 34, w: 250, h: 76, logo: 'openserv' },
      { id: 'workflow', title: 'Hourly desk review', sub: ['cron 0 * * * * (UTC)'], x: 24, y: 166, w: 250, h: 70 },
      { id: 'yours', title: 'Your workspace', sub: ['optional · link CODE', 'chat and tasks'], x: 24, y: 300, w: 250, h: 76 },
      { id: 'agent', title: 'Shijima agent', sub: ['runs in the worker', 'doTask · chat overridden'], x: 350, y: 180, w: 220, h: 90, tone: 'accent' },
      { id: 'serv', title: 'SERV Reasoning', sub: ['timing and chat answers'], x: 648, y: 34, w: 228, h: 70, logo: 'openserv' },
      { id: 'engine', title: 'The engine', sub: ['the same review', 'the timer runs'], x: 648, y: 180, w: 228, h: 76 },
      { id: 'identity', title: 'ERC-8004 identity', sub: ['Base · token 95396'], x: 648, y: 310, w: 228, h: 66, logo: 'base' },
    ],
    edges: [
      { from: 'platform', to: 'workflow', label: 'every hour', kind: 'action' },
      { from: 'workflow', to: 'agent', label: 'task', kind: 'action', points: [[274, 201], [350, 201]], labelAt: [312, 201] },
      { from: 'yours', to: 'agent', label: 'questions', kind: 'action', points: [[274, 338], [312, 338], [312, 250], [350, 250]], labelAt: [312, 300] },
      { from: 'agent', to: 'engine', label: 'review', kind: 'action', points: [[570, 218], [648, 218]], labelAt: [609, 218] },
      { from: 'engine', to: 'serv', label: 'when?', kind: 'action' },
      { from: 'agent', to: 'platform', label: 'log · done', kind: 'action', points: [[460, 180], [460, 72], [274, 72]], labelAt: [400, 72] },
      { from: 'agent', to: 'identity', label: 'who it is', kind: 'read', points: [[570, 250], [609, 250], [609, 343], [648, 343]], labelAt: [609, 300] },
    ],
  },
} satisfies Record<string, Diagram>;

export type DiagramName = keyof typeof diagrams;

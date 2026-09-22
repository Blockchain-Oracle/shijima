/**
 * /status: is the desk awake? Agari's status screen with our dependencies. Every sentence states what was read
 * and when; nothing says "all good" without the reading behind it (design brief 8.16, "has not checked in").
 */
const n = (v: number) => v.toLocaleString('en-US')
const plural = (count: number, one: string, many = `${one}s`) => `${n(count)} ${count === 1 ? one : many}`

export const statusCopy = {
  title: 'Status',
  description:
    'Is the desk awake: the worker, the hourly trigger, the reasoning engine, the chain and the prices, read live.',
  section: { index: '01', title: 'Is the desk awake' },
  desksSection: {
    index: '02',
    title: 'Desks',
    desc: 'Every shared desk, and yours if you are signed in. Each is checked every hour.',
  },
  countsSection: {
    index: '03',
    title: 'Counts',
    desc: 'Everything the desks have done, counted from the record.',
  },
  unreachable: 'Status could not read its own database just now. The desks run without this page.',
  healthy: 'Everything answering',
  degraded: 'Something needs attention',
  worst: (label: string) => `Worst: ${label}`,
  allFresh: 'Every reading below was taken just now.',
  checkpoint: 'Block',
  noBlock: 'unreachable',
  tableTitle: (count: number) => `Parts of the desk (${count})`,
  lag: (sec: number) =>
    sec < 120 ? `${sec}s` : sec < 7200 ? `${Math.round(sec / 60)}m` : `${Math.round(sec / 3600)}h`,
  latency: (ms: number) => (ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`),
  optional: 'not set up',
  expected: (session: string) => `${session.toLowerCase()} (expected)`,
  lastChecked: (clock: string) => `Read at ${clock} · refreshes every 30 s`,

  rows: {
    worker: 'Worker · heartbeat',
    openserv: 'OpenServ · hourly trigger',
    serv: 'SERV Reasoning · the timing call',
    rpc: 'Robinhood Chain · RPC',
    prices: 'Price log · every 5 minutes',
    feeds: 'Price feeds · Chainlink',
    halts: 'Trading status · Robinhood',
    telegram: 'Telegram · messages',
    chat: 'Chat · answers',
  },

  detail: {
    workerNever: 'no heartbeat on this database yet: the worker has not started here',
    workerDown: (ago: string) => `not running · last pass ${ago}`,
    workerSlow: (ago: string) => `running, but its last pass finished ${ago}`,
    workerOk: (every: string, ago: string, up: string) => `a pass every ${every} · last ${ago} · up ${up}`,
    commit: (sha: string) => `commit ${sha}`,
    rehearsal: 'rehearsal fork',
    lastError: (why: string) => `last pass failed: ${why}`,

    noDesks: 'no running desk to check',
    notRegistered: 'no OpenServ agent on this worker: its own timer runs the checks',
    hourCron: (hour: string, cron: number, total: number) =>
      `the ${hour} check was started by OpenServ · ${n(cron)} of ${plural(total, 'hourly check')} in 24 h`,
    hourTick: (hour: string, lastCron: string) =>
      `the ${hour} check was started by the worker's own timer, 7 minutes in; OpenServ last started one ${lastCron}`,
    hourTickNever: (hour: string) =>
      `the ${hour} check was started by the worker's own timer; OpenServ has not started one yet`,
    noHourly: (since: string) => `no hourly check since ${since}`,
    agent: (id: number) => `agent ${id}`,

    servNone: 'no call yet',
    servFailed: (ago: string, why: string) => `last call ${ago} failed: ${why}`,
    servOk: (ago: string, model: string) => `last answer ${ago} · ${model}`,
    servDay: (ok: number, failed: number) => `${plural(ok, 'answer')}, ${n(failed)} failed in 24 h`,

    rpcOk: (block: string, age: string) => `block ${block} · made ${age}`,
    rpcDown: (why: string) => `no answer: ${why}`,

    pricesNone: 'no price logged yet',
    pricesOk: (tokens: number, when: string) => `${plural(tokens, 'Stock Token')} priced ${when}`,

    feedsNone: 'no reading yet',
    feedsOk: (withFeed: number, tokens: number, newest: string) =>
      `${n(withFeed)} of ${n(tokens)} answering · newest official update ${newest}`,
    feedsMissing: (missing: number) =>
      `${plural(missing, 'feed')} missing: the desk will not trade those tokens`,
    oraclePaused: (symbols: string) => `paused by the issuer: ${symbols}`,

    haltsNone: 'no Stock Token paused',
    halted: (symbols: string) => `trading paused: ${symbols}`,
    haltUnknown: (symbols: string) => `status unreadable for ${symbols}: the desk will not trade them`,

    telegramOff: 'no bot on this worker',
    telegramOk: (ago: string) => `last message sent ${ago}`,
    telegramNone: 'nothing sent yet',
    telegramWaiting: (count: number) => `${plural(count, 'message')} waiting more than 2 minutes`,
    telegramFailed: (count: number) => `${plural(count, 'message')} failed in 24 h`,

    chatNone: 'no question yet',
    chatOk: (took: string, ago: string) => `last answer took ${took}, ${ago}`,
    chatWaiting: (count: number) => `${plural(count, 'question')} waiting more than a minute`,
    chatFailed: (count: number) => `${plural(count, 'question')} not answered in 24 h`,
  },

  desks: {
    tableTitle: (count: number) => `Desks (${count})`,
    none: 'No desk is shared yet.',
    yours: 'yours',
    unnamed: 'A desk',
    late: (ago: string) =>
      `Has not checked in. Last check was ${ago}. Its money is safe in its own account and cannot move without the assistant.`,
    never: (when: string) => `No check yet. The first is due ${when}.`,
    lastCheck: (ago: string, status: string) => `last check ${ago} · ${status}`,
    status: { completed: 'done', failed: 'failed', skipped: 'skipped', running: 'running now' } as Record<
      string,
      string
    >,
    paused: 'Paused by its owner. Nothing will happen until it is resumed.',
    stopped: 'Stopped by its own loss limit.',
    attention: 'Waiting for its owner: something changed that the desk will not guess about.',
  },

  counts: {
    desks: ['Desks running', 'each in its own contract'],
    checks: ['Checks completed', 'including the ones that did nothing'],
    records: ['Records written', 'each one hash-chained to the one before'],
    onChain: ['Fingerprints on the public network', 'actions and daily seals, each confirmed'],
  } satisfies Record<string, [string, string]>,
} as const

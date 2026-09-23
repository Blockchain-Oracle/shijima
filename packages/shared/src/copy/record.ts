/**
 * The record's pages: every decision, one decision in full, the report, and "Check it". Every word a reader sees
 * there lives here, so the banned-word rule covers it and the wording can change in one place.
 */

/** "Check it": the reader's own browser rebuilds the fingerprint and asks the public network for the one it holds. */
export const checkItCopy = {
  check: 'Check it',
  download: 'Download this record',
  showBytes: 'Show the exact bytes',
  hideBytes: 'Hide the exact bytes',
  before:
    'Your browser will rebuild this record’s fingerprint from the bytes below, then ask the public network for the fingerprint it holds and compare the two. The network is asked directly from your browser; nothing goes through us.',
  beforeUnsealed:
    'Your browser can rebuild this record’s fingerprint from the bytes below. It is not on the public network yet: the next action, or the daily seal, writes it there.',
  checking: 'Asking the public network…',
  computed: 'your browser computed',
  stored: 'stored with the record',
  onChain: 'held by the public network',
  seeTx: 'see the transaction',
  stepOwn: 'This record’s own transaction carries its fingerprint.',
  stepLater: (n: number, seq: number) =>
    `This record was sealed by record #${seq}. Your browser rebuilt the ${n} ${n === 1 ? 'record' : 'records'} between them and checked that each names the fingerprint of the one before it, so the fingerprint the network holds commits to this one.`,
  linkOk: (seq: number) => `#${seq} names the one before it and hashes as it should`,
  linkBroken: (seq: number) => `#${seq} does NOT match: the chain of records is broken here`,
  matches:
    'It matches. The fingerprint your browser computed is the one the public network holds. Nobody has changed this record since it was written, including us.',
  storedOnly:
    'The bytes match the fingerprint stored with the record, but your browser could not reach the public network to compare. Open the transaction and compare the fingerprint yourself.',
  mismatch:
    'It does NOT match. The public network holds a different fingerprint. Do not trust this record as shown.',
  storedMismatch: 'It does NOT match even the fingerprint stored with it. Something is wrong on our side.',
  unsealedResult:
    'The bytes match the fingerprint stored with the record. It is not on the public network yet, so the network cannot confirm it.',
  unsealedNext: (when: string) => `The next seal is due ${when}.`,
  unsealedNextUnknown: 'It will be sealed by the next action, or by the daily seal.',
  unknownSeal:
    'This record is marked as sealed, but the sealing record could not be found on our side. Open the transaction and compare the fingerprint yourself.',
  noEvent: 'The transaction holds no fingerprint for this agent. Do not trust this record as shown.',
} as const

/** Words shared by the record's pages. */
export const recordPagesCopy = {
  back: (name: string) => `← ${name}`,
  visitor: 'Someone else’s agent. You are reading its record; nothing here can be changed from this page.',
  practice: 'practice',
  modes: {
    shadow: 'Practice, spending nothing',
    ask_first: 'Asks before acting',
    on_its_own: 'Acts on its own',
  } as Record<string, string>,
  /** Whose desk: the reader's own, or its owner's, so a visitor is never addressed as the owner. */
  whose: (own: boolean) => (own ? 'your' : 'the owner’s'),
  who: (own: boolean) => (own ? 'You' : 'The owner'),
} as const

/** Every decision [8.10]. */
export const recordPageCopy = {
  title: 'Every decision',
  intro:
    'One entry for every check, including the ones that found nothing to do. Those are the proof it was awake.',
  empty: 'Nothing recorded yet.',
  emptyFiltered: 'Nothing matches those filters.',
  quiet: (n: number, from: string, to: string) => `${n} checks, nothing new · ${from} to ${to}`,
  older: 'Older →',
  filters: {
    title: 'Show',
    outcome: 'Outcome',
    anyOutcome: 'Any outcome',
    token: 'Stock Token',
    anyToken: 'Any Stock Token',
    live: { all: 'Practice and live', live: 'Live only', practice: 'Practice only' },
    from: 'From',
    to: 'To',
    apply: 'Apply',
    clear: 'Clear',
    dates: 'Pick dates',
    datesSet: 'Dates set',
  },
  quietRun: (n: number) => `${n} checks, nothing new`,
} as const

/** One decision, in full [8.11]. Section titles in the brief's order. */
export const decisionCopy = {
  back: '← every decision',
  /** The page's top card and its pictures (23 Sep, after Agari's S22 decision page). */
  hero: {
    sure: 'sure',
    noModel: 'no AI',
    seq: (n: number) => `#${n}`,
    buy: (amount: string, name: string) => `Buy ${amount} of ${name}`,
    sell: (amount: string, name: string) => `Sell ${amount} of ${name}`,
    sweep: (amount: string) => `Park ${amount} in the savings vault`,
    redeem: 'Take cash back from the savings vault',
    practice: 'Practice',
    live: 'Live',
  },
  strip: {
    aria: 'The pool price against its reference and the last official update',
    pool: 'Pool price',
    reference: 'Reference',
    official: 'Last official update',
    inLine: 'In line (±0.5%)',
  },
  drift: {
    aria: 'This holding against its target',
    now: (pct: string) => `Now ${pct}`,
    target: (pct: string) => `Target ${pct}`,
    wander: (pct: string) => `It may wander ${pct} either way`,
  },
  checks: {
    counted: 'Counts against your limits',
    floor: 'The least it would accept',
    passed: 'passed',
    refused: 'refused',
  },
  proofSteps: {
    written: 'Written down',
    fingerprinted: 'Fingerprinted',
    onChain: 'On the public network',
    waiting: 'Waiting for the next seal',
  },
  vault: 'the savings vault',
  sections: {
    decision: 'The decision',
    why: 'Why it looked',
    saw: 'What it saw',
    options: 'The options it weighed',
    limits: 'The limits check',
    cost: 'The cost, shown before acting',
    happened: 'What happened',
    asked: 'If you were asked',
    proof: 'Proof',
    now: 'How it looks now',
  },
  what: 'What',
  when: 'When',
  mode: 'Mode',
  howSure: 'How sure',
  noModel: 'no model was asked',
  override: (by: string, reason: string) =>
    `This was overruled by ${by}: ${reason} The assistant had chosen something else, shown below. It still could not get past the limits.`,
  approvalOf: (who: string, seq: number, when: string, via: string, moved: string) =>
    `${who} approved this in record #${seq}, answered ${when} on the ${via}. The price had moved ${moved} since it was shown.`,
  routine: 'A routine look. Nothing had changed that needed a decision.',
  ruleFired: (id: string) => `Raised by ${id === 'rule1' ? 'a standing rule of the owner’s' : id}.`,
  deferral: (seq: number) => `It had already decided this at record #${seq}.`,
  deferralStanding: 'Nothing measurable had changed since, so it did not ask again.',
  session: 'Market session',
  anchored: 'price anchored by market makers',
  unanchored: 'nothing anchors the price right now',
  tradingPrice: 'Trading price',
  theReference: 'the reference',
  reference: (label: string) => `Reference: ${label}`,
  set: (ago: string) => `set ${ago}`,
  priceWas: (compared: string) => `, the price was ${compared} it`,
  lastOfficial: 'Last official update',
  poolIs: (compared: string) => `, the pool is ${compared} it`,
  costLabel: 'What this trade costs',
  costMeasured: (fee: string) => `(the ${fee} pool fee, plus what its size moves the price)`,
  costTable: (fee: string) => `(the ${fee} pool fee, measured at a standard size, not this trade)`,
  status: 'Trading status',
  haltUnknown: 'could not be confirmed',
  halted: 'trading is paused in this token',
  open: 'trading is open',
  oraclePaused: ' · the price feed is paused',
  holding: 'This holding',
  holdingLine: (weight: string, target: string, wander: string) =>
    `${weight} of the agent’s value against a target of ${target}, allowed to wander ${wander}`,
  event: 'Company event',
  eventLine: (kind: string, date: string, timing: string | null, days: number) =>
    `${kind} on ${date}${timing ? `, ${timing}` : ''}, ${days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`}. Trading can pause around it.`,
  eventKinds: { earnings: 'Reports', dividend: 'A dividend', split: 'A split', other: 'An event' } as Record<
    string,
    string
  >,
  eventTiming: { bmo: 'before the open', amc: 'after the close' } as Record<string, string>,
  vaultLabel: 'The savings vault (Steakhouse USDG, on Morpho)',
  vaultRateUnknown: 'its rate could not be read',
  vaultRate: (rate: string) => `pays ${rate} a year after its fees`,
  vaultLiquidity: (amount: string) => ` · ${amount} could be taken out right then`,
  vaultFee: (amount: string) => ` · a deposit and a later withdrawal cost ${amount} in network fees`,
  vaultKeep: (amount: string) => ` · the agent keeps ${amount} in cash for its own buys`,
  limitsAt: (whose: string) => `${whose} limits at that moment`,
  limitsLine: (perAction: string, left: string, cash: string) =>
    `${perAction} per action · ${left} left today · ${cash} cash in the account`,
  headlines: (n: number) => `Headlines naming the company in the last 72 hours (${n})`,
  newsUnavailable: 'News was unavailable at that moment',
  noHeadlineText: 'The headline text is not shown here: our news licence does not allow passing it on.',
  unreadable: 'This record cannot be read by this version of the site.',
  options: {
    ACT_NOW: 'Do it now',
    ACT_PART: 'Do part of it now',
    WAIT_REOPEN: 'Wait for the market to reopen',
    DECLINE: 'Do not do it',
  } as Record<string, string>,
  chosen: 'chosen',
  turnedDown: 'turned down',
  noModelAsked: 'No model was asked.',
  vaultNoModel:
    'Moving cash into or out of the savings vault is arithmetic, not a question of timing, and the money never leaves the agent’s account.',
  arithmetic:
    'This part is plain arithmetic, not an assistant. It can refuse, and it can never start anything.',
  everyLimitPassed: 'Every limit passed.',
  vaultNoLimits:
    'Nothing counts against the limits: the money stays in the agent’s account, as the contract counts it.',
  refused: (reasons: string) => `Refused: ${reasons}.`,
  nothingToCheck: 'Nothing to check: the agent was not going to act.',
  spend: 'It would spend',
  receive: 'It should receive',
  least: 'The least it would accept',
  slippage: 'Slippage allowed',
  vaultShares: 'vault shares',
  vaultLeast: 'more than zero, the contract’s only rule for the vault',
  vaultSlippage: 'none: the vault sets its own share price',
  nothingSent: 'Nothing was sent.',
  received: (actual: string, expected: string) => `received ${actual} against ${expected} expected`,
  networkFee: (eth: string) => `network fee ${eth} ETH, paid by the assistant`,
  asked: {
    pending: (expires: string) => `Waiting for an answer. It expires ${expires}.`,
    approved: (who: string, when: string, via: string) => `${who} approved it ${when}, on the ${via}.`,
    rejected: (who: string, when: string, via: string) => `${who} rejected it ${when}, on the ${via}.`,
    expired: 'Nobody answered before it expired. Nothing was done, and that is recorded here.',
    cancelled: (why: string) => `It was withdrawn: ${why}.`,
    executed: (seq: number) => `What the agent then did is record #${seq}.`,
    notExecuted: 'The agent did not carry it out: the price had moved too far from what was shown.',
    via: { telegram: 'Telegram', web: 'website', chat: 'chat' } as Record<string, string>,
  },
  proofOwn:
    'The fingerprint of this record was written on the public network in the same transaction as the action it describes. Nobody can change the record now without the change being visible.',
  proofLater: (seq: number) =>
    `This record did nothing on the chain, so it has no transaction of its own. Record #${seq} was written on the public network later, and every record in between names the fingerprint of the one before it, so that fingerprint commits to this record too.`,
  proofUnsealed:
    'This record is not sealed yet. The next action, or the daily seal, writes a fingerprint on the public network that commits to it.',
  proofUnknown:
    'This record is marked as sealed, but the sealing transaction could not be matched on our side.',
  grade: {
    same: 'There was no real difference either way.',
    better: (pct: string) => `This turned out better than the alternative by ${pct}.`,
    worse: (pct: string) => `The alternative would have been better by ${pct}.`,
    ungradable: 'This one cannot be graded.',
    replay: ' · from a replay of a past weekend',
    notYet: 'Not yet. Each decision is graded once the US market has reopened.',
    vault:
      'Never graded: a savings-vault move is not a timing call, so there is no other moment to compare it with.',
  },
} as const

/** The weekend report [8.12]. */
export const reportCopy = {
  title: 'While the market was shut',
  reopened: 'the market has reopened',
  notYet: 'the market has not reopened yet',
  pending:
    'Each of these is graded once the market reopens, against the price it would really have got then.',
  better: (chosen: string, alternative: string, pct: string) =>
    `${chosen} came out better than ${alternative} by ${pct}.`,
  worse: (alternative: string, pct: string) => `${alternative} would have been better by ${pct}.`,
  same: 'No real difference either way, inside the cost of trading.',
  ungradable: 'This one cannot be graded.',
  notGraded: 'Not graded yet.',
  past: 'Past reports',
  thisOne: 'this one',
  quietOnly: 'Only quiet checks in this stretch: nothing to grade.',
} as const

/** Your desks: the list for an owner of more than one. */
export const desksCopy = {
  title: 'Your agents',
  signIn: 'Connect your wallet and sign in above to see them. Signing costs nothing and moves nothing.',
  none: 'This wallet does not own an agent yet. An agent is an account on the network that only you can withdraw from, and the AI that looks after it inside limits you set.',
  makeOne: 'Make one in Strategies →',
  publicView: 'The public view →',
  open: 'Open →',
  worth: (amount: string) => `worth ${amount}`,
  waiting: 'Waiting for you',
  nothing: 'Nothing needs you',
  lastCheck: (ago: string, summary: string) => `Last check ${ago}: ${summary}`,
  notChecked: 'It has not checked yet.',
  large: ' · asking because this one is large',
  telegramOff: 'Telegram is not connected, so it can only ask you here.',
  practiceLine: (done: number, needed: number, read: boolean) =>
    `${Math.min(done, needed)} of ${needed} practice hours done · ${read ? 'report read' : 'report not read yet'}`,
  ready: ' · it can go live when you choose',
  practiceNote:
    'In practice mode the agent decides for real and spends nothing. None of your money has moved.',
} as const

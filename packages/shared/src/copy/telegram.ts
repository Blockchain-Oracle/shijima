/**
 * Every word the desk says in Telegram.
 *
 * The problem this solves: an hourly desk makes about 160 decisions a week and most of them are "nothing to
 * do". Sending 160 messages would make the owner mute it, and a muted desk is a useless one. So there is ONE
 * pinned status message that is edited in place and never notifies, and a new message is sent only when
 * something actually needs the owner or has really happened.
 *
 * Telegram is told to use HTML, so anything from outside, a company name or a model's sentence, must go
 * through `esc` before it lands in a message.
 */
export const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const b = (s: string) => `<b>${esc(s)}</b>`

export const telegramCopy = {
  /** 9.9 First contact. Said once, when a desk is linked. */
  firstContact: (deskName: string) =>
    [
      b('This is Shijima.'),
      '',
      `I look after ${esc(deskName)} while the US market is shut.`,
      '',
      'I watch every five minutes and wake when something moves. Most of the time there is nothing to do, and I will not tell you about those. They go in the pinned message, which I edit quietly.',
      '',
      'I will message you when something needs you, when I have done something, or when something has gone wrong. Nothing else.',
      '',
      'Your money stays in your own account. I can trade inside the limits you set, and I can never send it anywhere but back to you.',
    ].join('\n'),

  /** 9.1 The pinned status message. Edited in place at every check. Never notifies. */
  status: (s: {
    mode: string
    state: string
    lastCheck: string
    lastResult: string
    holdings: string[]
    value: string
    cash: string
    spentToday: string
    dailyCap: string
    nextCheck: string
    market: string
  }) =>
    [
      b(`${s.mode} · ${s.state}`),
      `Last check ${esc(s.lastCheck)}. ${esc(s.lastResult)}`,
      ...(s.holdings.length > 0 ? [esc(s.holdings.join('. '))] : []),
      `Value ${esc(s.value)}. Cash ${esc(s.cash)}.`,
      `Spent today ${esc(s.spentToday)} of ${esc(s.dailyCap)}.`,
      `Watching. Next look ${esc(s.nextCheck)}. ${esc(s.market)}`,
      'Times are New York time.',
    ].join('\n'),

  /** Said when a chat links before the desk has ever checked. */
  notCheckedYet: 'It has not checked yet. The pinned message appears after its first check.',

  /** 9.2 and 9.4. What it wants to do, why, what it turned down, and when the request dies. */
  approvalRequest: (a: {
    large: boolean
    what: string
    why: string
    turnedDown: string | undefined
    confidence: string
    expires: string
  }) =>
    [
      b(
        a.large
          ? `Approval needed, this one is large · expires ${a.expires}`
          : `Approval needed · expires ${a.expires}`,
      ),
      esc(a.what),
      `Why: ${esc(a.why)}`,
      ...(a.turnedDown ? [`Turned down: ${esc(a.turnedDown)}`] : []),
      `How sure: ${esc(a.confidence)}`,
      '',
      'If you do not answer by then, nothing happens and that is recorded too.',
    ].join('\n'),

  /** What the request becomes once it is answered, wherever it was answered. */
  approvalAnswered: (
    answer: 'approved' | 'rejected' | 'expired' | 'cancelled',
    what: string,
    where?: string,
  ) =>
    ({
      approved: `${b('Approved')}\n${esc(what)}\nI will check the price again and act only if it is still close to what you were shown.${where ? `\nAnswered on the ${esc(where)}.` : ''}`,
      rejected: `${b('Rejected')}\n${esc(what)}\nNothing was done, and the refusal is recorded.${where ? `\nAnswered on the ${esc(where)}.` : ''}`,
      expired: `${b('Expired')}\n${esc(what)}\nYou did not answer in time, so nothing was done. It is recorded.`,
      cancelled: `${b('Cancelled')}\n${esc(what)}\nYour settings or the agent changed, so this request no longer applies. Nothing was done.`,
    })[answer],
  /** A button pressed after the request was answered elsewhere, or had lapsed. The message shows how. */
  alreadyAnswered: 'This request was already answered, or has lapsed. The message shows how it ended.',
  /** Where an answer came from, for the line under it. */
  answeredWhere: { web: 'website', chat: 'chat', telegram: 'buttons here' } as const,

  /** 9.8 The Monday report. One short message with a link to the full page. */
  mondayReport: (text: string, url: string) => `${b('The report is ready')}\n${esc(text)}\n${esc(url)}`,

  /** 9.3 It acted. 9.5 It would have, in practice mode. */
  acted: (what: string, why: string) => `${b('I did this')}\n${esc(what)}\n${esc(why)}`,
  wouldHave: (what: string, why: string) =>
    `${b('I would have done this')}\n${esc(what)}\n${esc(why)}\n\nPractice mode, so nothing was spent.`,

  /** 9.6 A non-action worth knowing about. Never the routine ones. */
  notActed: (what: string, why: string) => `${b('I chose not to act')}\n${esc(what)}\n${esc(why)}`,

  /** 9.7 Alerts. Each short and specific. */
  alert: (text: string) => `${b('Heads up')}\n${esc(text)}`,

  /** The bot's own profile: what Telegram shows before anyone has pressed Start. */
  profile: {
    name: 'Shijima',
    shortDescription: 'Keeps your Stock Token basket on track while Wall Street sleeps.',
    description: [
      'Shijima looks after a basket of Stock Tokens on Robinhood Chain while the US market is shut.',
      '',
      'You choose what to hold. It decides only when to move toward it, inside limits your own account enforces, and writes every decision down where anyone can check it.',
      '',
      'Press Start, then connect your agent from the website.',
    ].join('\n'),
    commands: [
      { command: 'start', description: 'Your agent at a glance' },
      { command: 'portfolio', description: 'What it holds and what it is worth' },
      { command: 'record', description: 'The last few decisions' },
      { command: 'pause', description: 'Stop acting. Nothing is sold' },
      { command: 'resume', description: 'Start acting again' },
      { command: 'ask', description: 'How to ask the agent anything' },
      { command: 'help', description: 'Everything I understand' },
    ],
  },

  /** /start before a desk is linked. The photo carries the brand; this carries the words. */
  welcome: (siteUrl: string, canButton: boolean) =>
    [
      b('Welcome to Shijima.'),
      '',
      'I look after a basket of Stock Tokens while the US market is shut. I decide only when to act, never what to own, and I write every decision down.',
      '',
      canButton
        ? 'To hear from your agent here, connect it from the website.'
        : `To hear from your agent here, open ${esc(siteUrl)}, go to your agent, and choose Connect Telegram.`,
    ].join('\n'),
  connectButton: 'Connect my agent',
  howButton: 'How it works',

  /** The main menu under /start once linked. Every view edits this one message. */
  menu: {
    title: (deskName: string, mode: string, state: string) =>
      `${b(deskName)}\n${esc(mode)} · ${esc(state)}\n\nWhat would you like to see?`,
    portfolio: '📈 Portfolio',
    record: '🧾 Record',
    pause: '⏸ Pause',
    resume: '▶ Resume',
    ask: '💬 Ask',
    open: '🌐 Open Shijima',
    back: '‹ Back',
    refresh: '↻ Refresh',
  },
  /** The portfolio view in the menu: the pinned status, with a header. */
  portfolioView: (status: string) => `${b('Portfolio')}\n\n${status}`,
  /** The record view: the last few decisions, newest first. */
  recordView: (lines: string[], url: string | undefined) =>
    [
      b('The record'),
      '',
      ...(lines.length > 0 ? lines : ['Nothing decided yet. The first check writes the first line.']),
      ...(url ? ['', `Every decision: ${esc(url)}`] : []),
    ].join('\n'),
  recordLine: (ago: string, outcome: string, summary: string) =>
    `• ${esc(ago)} · ${b(outcome)}\n  ${esc(summary)}`,
  askHint: [
    b('Ask me anything'),
    '',
    'Just write to me here. "What are you holding?", "Why did you wait last night?", "Sell half the Nvidia."',
    '',
    'I answer in this chat. Anything that would change the agent comes back as a card for you to confirm first.',
  ].join('\n'),

  /** 9.10 Commands. */
  help: [
    b('What you can ask me'),
    '/start  your agent at a glance',
    '/portfolio  what it holds and what it is worth',
    '/record  the last few decisions',
    '/status  bring the pinned message up to date',
    '/pause  stop acting. Nothing is sold',
    '/resume  start acting again',
    '/help  this',
    '',
    'Or just write to me. Ask what the agent is doing and why, or tell me what you want changed. I show you a card before anything changes.',
    '',
    'Approving and rejecting happen on the buttons, or on the website. Either works.',
  ].join('\n'),

  paused: 'Paused. Nothing will happen until you resume. Nothing was sold.',
  resumed: 'Active again. I am watching.',
  alreadyInThatState: 'Nothing changed: it was already like that.',
  notLinked:
    'This chat is not linked to an agent. Open your agent on the website, choose Connect Telegram, and send me the code it gives you.',
  linkUsed: 'That code has already been used, or it has expired. Ask the website for a new one.',
  notYourDesk: 'This agent is linked to someone else. I will not answer about it here.',
  seeDetails: 'See the full decision',

  /** The chat, in Telegram. The desk's words are sent as plain text, never as HTML. */
  askSlowDown: {
    minute: 'That is a lot of messages at once. Give me a minute.',
    day: 'That is today’s allowance of messages. I will answer again tomorrow. The agent keeps checking as usual.',
  },
  askStillThinking: 'I am still working on that one. Ask again in a minute if no answer comes.',
  askThinking: 'Thinking. I will answer here in a moment.',
  unknownCommand: 'I do not know that command. /help lists the ones I do.',
  linkedElsewhere:
    'This Telegram account already hears about another agent. Disconnect that one first, in its settings on the website, before linking this one.',
  /** Every clock in these messages is New York time, where the market is. */
  timesAreNewYork: 'New York time',
  askFailed: 'I could not answer just now. Nothing was changed.',
  confirm: 'Confirm',
  notNow: 'Not now',
  leftAlone: 'Left alone. Nothing was changed.',
  confirmOnSite: 'Confirm on the website',
  confirmOnSiteNote: 'This one needs your wallet or your session key, so it is confirmed on the website.',
} as const

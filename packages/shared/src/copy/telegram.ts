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
      'I check every hour. Most of the time there is nothing to do, and I will not tell you about those: they',
      'go in the pinned message above, which I edit quietly.',
      '',
      'I will send you a message when something needs you, when I have done something, or when something has',
      'gone wrong. Nothing else.',
      '',
      'Your money stays in your own account. I can trade inside the limits you set, and I can never send it',
      'anywhere but back to you.',
    ].join('\n'),

  /** 9.1 The pinned status message. Edited in place at every check. Never notifies. */
  status: (s: {
    mode: string
    state: string
    lastCheck: string
    lastResult: string
    holdings: string[]
    value: string
    spentToday: string
    dailyCap: string
    nextCheck: string
    marketOpens: string
  }) =>
    [
      b(`${s.mode} · ${s.state}`),
      `Last check ${esc(s.lastCheck)}. ${esc(s.lastResult)}`,
      ...(s.holdings.length > 0 ? [esc(s.holdings.join('. '))] : []),
      `Value ${esc(s.value)}. Spent today ${esc(s.spentToday)} of ${esc(s.dailyCap)}.`,
      `Next check ${esc(s.nextCheck)}. ${esc(s.marketOpens)}`,
    ].join('\n'),

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
  approvalAnswered: (answer: 'approved' | 'rejected' | 'expired', what: string, where?: string) =>
    ({
      approved: `${b('Approved')}\n${esc(what)}\nI will check the price again and act only if it is still close to what you were shown.${where ? `\nAnswered on the ${esc(where)}.` : ''}`,
      rejected: `${b('Rejected')}\n${esc(what)}\nNothing was done, and the refusal is recorded.${where ? `\nAnswered on the ${esc(where)}.` : ''}`,
      expired: `${b('Expired')}\n${esc(what)}\nYou did not answer in time, so nothing was done. It is recorded.`,
    })[answer],

  /** 9.3 It acted. 9.5 It would have, in practice mode. */
  acted: (what: string, why: string) => `${b('I did this')}\n${esc(what)}\n${esc(why)}`,
  wouldHave: (what: string, why: string) =>
    `${b('I would have done this')}\n${esc(what)}\n${esc(why)}\n\nPractice mode, so nothing was spent.`,

  /** 9.6 A non-action worth knowing about. Never the routine ones. */
  notActed: (what: string, why: string) => `${b('I chose not to act')}\n${esc(what)}\n${esc(why)}`,

  /** 9.7 Alerts. Each short and specific. */
  alert: (text: string) => `${b('Heads up')}\n${esc(text)}`,

  /** 9.10 Commands. */
  help: [
    b('What you can ask me'),
    '/status  what the desk is doing right now',
    '/pause  stop acting. Nothing is sold',
    '/resume  start acting again',
    '/help  this',
    '',
    'Approving and rejecting happen on the buttons, or on the website. Either works.',
  ].join('\n'),

  paused: 'Paused. Nothing will happen until you resume. Nothing was sold.',
  resumed: 'Active again. I will check at the top of the hour.',
  alreadyInThatState: 'Nothing changed: it was already like that.',
  notLinked:
    'This chat is not linked to a desk. Open your desk on the website, choose Connect Telegram, and send me the code it gives you.',
  linkUsed: 'That code has already been used, or it has expired. Ask the website for a new one.',
  notYourDesk: 'This desk is linked to someone else. I will not answer about it here.',
  seeDetails: 'See the full decision',
} as const

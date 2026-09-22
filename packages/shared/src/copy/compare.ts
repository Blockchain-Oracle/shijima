/**
 * "With and without reasoning" (design brief 8.20): the same timing question, asked of the same model on its own
 * and through SERV Reasoning, side by side. Neither answer is called right; the reader sees both, and sees which
 * one the desk's own checks would have accepted.
 */
export const compareCopy = {
  title: 'With and without reasoning',
  lead: 'The same question, asked two ways. On the left, the model on its own. On the right, the same model through SERV Reasoning, which is what the desk uses. Same instructions, same facts, same answer format: the only difference is SERV.',
  back: 'Back to How it works',
  pickLabel: 'Saved situations',
  tag: 'Saved situation, not a live quote',
  example:
    'A saved situation. The prices, the headlines and the owner’s note were written for this comparison; the message itself is built by the same code as a live check.',
  lookFor: 'What to look for',
  shown: 'Exactly what both were shown',
  situations: {
    'report-coming': {
      tab: 'A report coming',
      title: 'An old reference, and a report coming',
      summary:
        'Sunday. Nvidia’s pool is 2.2% below where it traded at Friday’s close. Arithmetic wants to buy. A headline says the company reports on Wednesday, and the owner’s note says not to add before a report.',
      lookFor: 'Does it apply the owner’s note, and cite it as r1?',
    },
    'gap-no-news': {
      tab: 'A drop, no news',
      title: 'A weekend drop with nothing to explain it',
      summary:
        'Saturday. Tesla’s pool is 2.6% below its Friday reference, with nothing tying it to the real market. Arithmetic wants to buy, and no headline names the company.',
      lookFor: 'Does it buy a weekend move it cannot explain, or wait for Monday’s open?',
    },
    'mentions-not-explains': {
      tab: 'Headlines, no event',
      title: 'Headlines that name the company and explain nothing',
      summary:
        'Sunday. Meta’s pool is 1.9% above its Friday reference. Arithmetic wants to sell, and three headlines mention Meta without any material event.',
      lookFor: 'Does it treat a mention as an explanation for the move?',
    },
  },
  columns: {
    raw: { title: 'The model on its own', sub: (model: string) => `${model}, SERV’s reasoning layer off` },
    serv: { title: 'Through SERV Reasoning', sub: (model: string) => `${model}, as the desk calls it` },
  },
  notRun: 'Not run yet. The answer appears here once this situation has been asked.',
  options: {
    ACT_NOW: 'Do it now',
    ACT_PART: 'Do part of it now',
    WAIT_REOPEN: 'Wait for the market to reopen',
    DECLINE: 'Do not do it',
  } as Record<string, string>,
  part: (percent: number) => `${percent}% now`,
  confidence: (percent: number) => `${percent}% sure of the timing`,
  reasons: 'Why',
  rejected: 'Turned down',
  news: {
    yes: 'Says the news explains the move',
    no: 'Says the news does not explain the move',
    unclear: 'Unsure whether the news explains the move',
    not_applicable: 'News not relevant here',
  } as Record<string, string>,
  rules: (ids: string) => `Owner’s note applied: ${ids}`,
  noRules: 'No owner’s note applied',
  warnings: 'Warnings',
  accepted: 'The desk’s checks would accept this answer.',
  refused: 'The desk’s checks would throw this answer away:',
  meta: (seconds: string, tokens: string, when: string) =>
    `Answered in ${seconds} · ${tokens} tokens · asked ${when}`,
  cites: (ids: string) => `cites ${ids}`,
} as const

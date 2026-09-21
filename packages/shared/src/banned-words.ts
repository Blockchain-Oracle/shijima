/**
 * Words the product never uses, from design brief section 4 and the issuer's own rules. "Stock Tokens" is a
 * legal requirement, and nothing here may read as a promise of gain.
 *
 * The model's prose is checked with this before a decision is accepted, and so is our own copy. Whole words
 * only: "alpha" must not catch Alphabet, and "ape" must not catch "shape".
 */
/**
 * Two lists, because they carry different weight.
 *
 * HARD words are dangerous: a promise of gain, or a name the issuer forbids, or a price label that is simply
 * untrue. If the model writes one, its whole answer is thrown away and the desk does nothing that hour.
 * STYLE words are the product's voice. If the model writes one, the decision still stands: throwing away a
 * sound judgment because of a word would cost the owner more than the word does. It is noted in the record.
 */
const HARD: [RegExp, string][] = [
  [/\bprofit(s|able|ability)?\b/i, 'profit'],
  [/\bguarantee[sd]?\b/i, 'guaranteed'],
  [/\bbeat(s|ing)? the market\b/i, 'beat the market'],
  [/\btokeni[sz]ed stocks?\b/i, 'tokenized stocks (write "Stock Tokens")'],
  [/\blast close\b/i, 'last close (write "last official update")'],
]

const STYLE: [RegExp, string][] = [
  [/\balpha\b/i, 'alpha'],
  [/\bsignals?\b/i, 'signal'],
  [/\bsnip(e|ed|ing)\b/i, 'snipe'],
  [/\bap(e|ed|ing)\b/i, 'ape'],
  [/\bdegens?\b/i, 'degen'],
  [/🚀/u, 'rocket emoji'],
]

const BANNED: [RegExp, string][] = [...HARD, ...STYLE]

const find = (list: [RegExp, string][], text: string) =>
  list.filter(([pattern]) => pattern.test(text)).map(([, name]) => name)

/** Every banned word in a text, named once each. Empty means the text is clean. Used on OUR OWN copy. */
export const findBannedWords = (text: string): string[] => find(BANNED, text)

/** Words that make an answer unusable: a promise, or a name we are not allowed to use. */
export const findHardBannedWords = (text: string): string[] => find(HARD, text)

/** Words that are only the product's voice. Worth noting, never worth losing a decision over. */
export const findStyleWords = (text: string): string[] => find(STYLE, text)

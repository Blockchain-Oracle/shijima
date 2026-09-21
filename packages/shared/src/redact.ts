/**
 * Keeps secrets out of anything a person or a database ever sees.
 *
 * The reason this exists, confirmed on 2026-09-20: viem puts the FULL request URL and body into its error
 * messages, and our RPC URL carries the Alchemy key in its path. Those messages are printed by every command,
 * logged by the worker, and STORED in `wakes.error` and `actions.failure_detail`. Without this, one dropped
 * connection would write the key into the database and the terminal.
 *
 * Two layers, because either alone would miss something:
 *   1. exact match on values registered at startup (the keys and URLs we know we hold)
 *   2. patterns for credentials that arrive from somewhere we did not register
 *
 * Deliberately NOT redacted: any bare 32-byte hex value. A private key is that shape, but so is every
 * transaction hash and every record fingerprint, and those are the product's whole point. Private keys are
 * caught by exact match instead.
 */

const secrets = new Set<string>()

/** Values shorter than this are not distinctive enough to blank out safely. */
const MIN_SECRET_LENGTH = 12

/** The environment variables that hold something secret. Their values are never printed or stored. */
export const SECRET_ENV_NAMES = [
  'ALCHEMY_KEY',
  'SERV_API_KEY',
  'FINNHUB_API_KEY',
  'TAVILY_API_KEY',
  'OPERATOR_PRIVATE_KEY',
  'DEPLOYER_PRIVATE_KEY',
  'WALLET_PRIVATE_KEY',
  'TELEGRAM_BOT_TOKEN',
  'DATABASE_URL',
  'TEST_DATABASE_URL',
  'REHEARSAL_DATABASE_URL',
  'RPC_URL',
] as const

export function registerSecrets(...values: (string | undefined | null)[]): void {
  for (const value of values) {
    if (typeof value === 'string' && value.length >= MIN_SECRET_LENGTH) secrets.add(value)
  }
}

/** The caller passes its own `process.env`, so this file needs no Node and stays safe in a browser bundle. */
export function registerSecretsFromEnv(env: Record<string, string | undefined>): void {
  registerSecrets(...SECRET_ENV_NAMES.map((name) => env[name]))
}

const PATTERNS: [RegExp, string][] = [
  // An API key in a URL path: https://<host>/v2/<key>
  [/(\/v[0-9]\/)[A-Za-z0-9_-]{16,}/g, '$1<redacted>'],
  // Credentials in any connection string: scheme://user:password@host
  [/(\b[a-z][a-z0-9+.-]*:\/\/)[^\s/@:]+:[^\s/@]*@/gi, '$1<redacted>@'],
  // An API key passed as a query parameter.
  [/([?&](?:api_?key|token|key|access_token)=)[^&\s"']+/gi, '$1<redacted>'],
]

/** The text with every known secret and every credential-shaped pattern blanked out. */
export function redact(text: string): string {
  let out = text
  for (const secret of secrets) {
    if (out.includes(secret)) out = out.split(secret).join('<redacted>')
  }
  for (const [pattern, replacement] of PATTERNS) out = out.replace(pattern, replacement)
  return out
}

/**
 * The message of any thrown value, redacted, on one line, and bounded. viem errors run to dozens of lines of
 * request body, which is useless in a log and is exactly where a secret hides.
 */
export function errorText(e: unknown, maxLength = 300): string {
  const raw = e instanceof Error ? e.message : String(e)
  const oneLine = redact(raw).split('\n')[0]?.trim() ?? ''
  return oneLine.length > maxLength ? `${oneLine.slice(0, maxLength - 1)}…` : oneLine
}

import { databaseName } from '@desk/db'
import { registerSecretsFromEnv } from '@desk/shared'
import { z } from 'zod'

/** Parsed once. A missing value fails here with its name, never later with an undefined. Values are never logged. */
const Env = z.object({
  ALCHEMY_KEY: z.string().min(1),
  SERV_API_KEY: z.string().min(1),
  OPERATOR_PRIVATE_KEY: z.string().regex(/^0x[0-9a-fA-F]{64}$/, 'must be a 32 byte hex private key'),
  DATABASE_URL: z.string().url(),
  REHEARSAL_DATABASE_URL: z.string().url().optional(),
  RPC_URL: z.string().url().optional(),
  /** Optional. Without it the desk works exactly as before, it just has no voice. */
  TELEGRAM_BOT_TOKEN: z.string().min(20).optional(),
  /** Where the decision pages live, for the link on a request. */
  SITE_URL: z.string().url().optional(),
})

export function loadEnv() {
  // Register before anything can throw: a connection error carries the RPC URL, which carries the key.
  registerSecretsFromEnv(process.env)
  const parsed = Env.safeParse(process.env)
  if (!parsed.success) {
    const names = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
    throw new Error(`Bad or missing environment variables. ${names}. See .env.example.`)
  }
  const e = parsed.data
  const isRehearsal = Boolean(e.RPC_URL)

  // A rehearsal runs on a throwaway fork, so it gets a throwaway database. Pointing the resolver at a fork
  // while it reads the real records would find no receipt for a real transaction and wrongly call it dead.
  const databaseUrl = isRehearsal ? e.REHEARSAL_DATABASE_URL : e.DATABASE_URL
  if (!databaseUrl)
    throw new Error('RPC_URL is set, so this is a rehearsal and needs REHEARSAL_DATABASE_URL.')
  const name = databaseName(databaseUrl)
  if (isRehearsal !== name.endsWith('_rehearsal') || name.endsWith('_test')) {
    throw new Error(
      isRehearsal
        ? `A rehearsal must use a database whose name ends in _rehearsal, not "${name}".`
        : `A live run must not use the database "${name}".`,
    )
  }
  return {
    ...e,
    rpcUrl: e.RPC_URL ?? `https://robinhood-mainnet.g.alchemy.com/v2/${e.ALCHEMY_KEY}`,
    isRehearsal,
    databaseUrl,
  }
}

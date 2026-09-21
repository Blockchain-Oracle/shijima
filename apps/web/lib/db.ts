/**
 * One database handle for the whole web app.
 *
 * The web app READS. It never signs, never sends a transaction and never calls a provider. The one thing it
 * writes is an owner's answer to a request, through the same guarded update the worker relies on.
 */
import { createDb, type Db } from '@desk/db'
import { registerSecretsFromEnv } from '@desk/shared'

declare global {
  var __deskDb: Db | undefined
}

export function db(): Db {
  if (!globalThis.__deskDb) {
    registerSecretsFromEnv(process.env)
    const url = process.env.DATABASE_URL
    if (!url) throw new Error('DATABASE_URL is missing. See .env.example.')
    // Small pool: serverless instances are reused, and the worker needs the connections more than we do.
    globalThis.__deskDb = createDb(url, { max: 2 }).db
  }
  return globalThis.__deskDb
}

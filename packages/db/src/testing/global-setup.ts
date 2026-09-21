/**
 * Runs once before the database tests: empties the TEST database and applies every migration from zero, so
 * each run also proves that the migrations build the schema on their own.
 *
 * It refuses any database whose name does not end in `_test`. The dev database holds the real record of real
 * mainnet trades, so a wrong URL here must fail loudly and never drop anything.
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseEnv } from 'node:util'
import { sql } from 'drizzle-orm'
import type { TestProject } from 'vitest/node'
import { createDb, databaseName } from '../client'
import { migrateDb } from '../migrate'

declare module 'vitest' {
  export interface ProvidedContext {
    testDatabaseUrl: string | null
  }
}

/** Reads ONE name from the root .env, so tests never get the API keys or private keys that live there. */
function testDatabaseUrl(): string | undefined {
  if (process.env.TEST_DATABASE_URL) return process.env.TEST_DATABASE_URL
  const envFile = resolve(import.meta.dirname, '../../../../.env')
  if (!existsSync(envFile)) return undefined
  return parseEnv(readFileSync(envFile, 'utf8')).TEST_DATABASE_URL || undefined
}

export default async function setup(project: TestProject) {
  const url = testDatabaseUrl()
  if (!url) {
    // On a laptop with no Postgres the database tests skip, loudly. In CI a missing database is a failure.
    if (process.env.CI) throw new Error('TEST_DATABASE_URL is not set in CI, so database tests cannot run')
    console.warn('\n[db] TEST_DATABASE_URL is not set. DATABASE TESTS ARE SKIPPED. See .env.example.\n')
    project.provide('testDatabaseUrl', null)
    return
  }
  const name = databaseName(url)
  if (!name.endsWith('_test')) {
    throw new Error(`Refusing to reset "${name}". The test database name must end in _test.`)
  }
  const handle = createDb(url, { max: 1 })
  try {
    await handle.db.execute(sql`drop schema if exists public cascade`)
    await handle.db.execute(sql`drop schema if exists drizzle cascade`)
    await handle.db.execute(sql`create schema public`)
  } finally {
    await handle.close()
  }
  await migrateDb(url)
  project.provide('testDatabaseUrl', url)
}

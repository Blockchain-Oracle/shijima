/**
 *   pnpm db:migrate          apply pending migrations to DATABASE_URL
 *   pnpm db:migrate --test   the same for TEST_DATABASE_URL
 */

import { errorText, registerSecretsFromEnv } from '@desk/shared'
import { databaseName } from '../client'
import { migrateDb } from '../migrate'

registerSecretsFromEnv(process.env)
const name = process.argv.includes('--test') ? 'TEST_DATABASE_URL' : 'DATABASE_URL'
const url = process.env[name]
if (!url) {
  console.error(`${name} is missing. See .env.example.`)
  process.exit(1)
}
try {
  await migrateDb(url)
  console.log(`migrations applied to ${databaseName(url)}`)
} catch (e) {
  console.error(errorText(e))
  process.exit(1)
}

/**
 *   pnpm rehearsal:reset    make the rehearsal database an exact copy of the live one
 *
 * A rehearsal runs on a throwaway fork of mainnet. A fork taken NOW already contains every real trade the desk
 * has made, so the database that goes with it must contain them too: same desk, same records, same mandate,
 * same on-chain sequence. Start a new fork, run this, and the two match. Nothing here can touch `desk_dev`:
 * it is only read, with pg_dump.
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { databaseName } from '@desk/db'
import { recreateDatabase } from '@desk/db/admin'
import { registerSecretsFromEnv } from '@desk/shared'

registerSecretsFromEnv(process.env)

const live = process.env.DATABASE_URL
const rehearsal = process.env.REHEARSAL_DATABASE_URL
if (!live || !rehearsal) throw new Error('DATABASE_URL and REHEARSAL_DATABASE_URL must both be in .env')

await recreateDatabase(rehearsal, '_rehearsal', { migrate: false })
const dump = execFileSync('pg_dump', ['--no-owner', '--no-privileges', live], {
  maxBuffer: 512 * 1024 * 1024,
})
const restored = spawnSync('psql', ['--quiet', '--set', 'ON_ERROR_STOP=1', rehearsal], { input: dump })
if (restored.status !== 0)
  throw new Error(`restoring into the rehearsal database failed: ${restored.stderr.toString()}`)
console.log(`${databaseName(rehearsal)} is now a copy of ${databaseName(live)}`)

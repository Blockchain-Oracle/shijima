import { defineConfig } from 'drizzle-kit'

/**
 * Only `generate` and `check` use this file, and neither needs a database. Migrations are APPLIED by our own
 * script (src/bin/migrate.ts), so the same code path runs on a laptop, in CI and as the worker's pre-deploy step.
 */
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema/index.ts',
  out: './drizzle',
})

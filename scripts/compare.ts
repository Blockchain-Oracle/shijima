/**
 * "With and without reasoning" (design brief 8.20): asks SERV's model each saved situation twice, once through
 * SERV Reasoning as the desk does and once raw, and saves both answers for the /compare page.
 *
 *   pnpm compare:run                  every situation, both ways
 *   pnpm compare:run --only gap-no-news
 *
 * The page never calls a model: the website holds no key, and a comparison should not change each time a
 * visitor opens it. Each call is logged in serv_calls like every other. It costs a few cents per run.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { APPROVED_TOKENS } from '@desk/chain'
import { type CompareMode, type ComparisonRun, runComparison, SITUATION_IDS, situations } from '@desk/core'
import { createDb, logServCall } from '@desk/db'
import { errorText, registerSecretsFromEnv } from '@desk/shared'

registerSecretsFromEnv(process.env)
const FILE = resolve(import.meta.dirname, '../apps/web/data/compare.json')
const apiKey = process.env.SERV_API_KEY
const url = process.env.DATABASE_URL
if (!apiKey || !url) {
  console.error('SERV_API_KEY and DATABASE_URL are needed. See .env.example.')
  process.exit(1)
}
const onlyAt = process.argv.indexOf('--only')
const only = onlyAt > 0 ? process.argv[onlyAt + 1] : undefined
if (only && !SITUATION_IDS.includes(only as (typeof SITUATION_IDS)[number])) {
  console.error(`No situation "${only}". Known: ${SITUATION_IDS.join(', ')}`)
  process.exit(1)
}

const { db, close } = createDb(url)
const saved = JSON.parse(readFileSync(FILE, 'utf8')) as { runs: ComparisonRun[] }
const runs = new Map(saved.runs.map((r) => [`${r.situation}:${r.mode}`, r]))
try {
  for (const s of situations(APPROVED_TOKENS)) {
    if (only && s.id !== only) continue
    // Raw first, then SERV: neither can warm a cache the other then benefits from, since the braid is off in raw.
    for (const mode of ['raw', 'serv'] as CompareMode[]) {
      const run = await runComparison(apiKey, s, mode)
      await logServCall(db, {
        purpose: 'compare',
        promptVersion: run.promptVersion,
        model: run.model,
        mode,
        ok: run.error === null,
        error: run.error,
        rejectedByOurChecks: run.problems,
        latencyMs: run.latencyMs,
        totalTokens: run.totalTokens,
      }).catch((e) => console.error(`could not log the call: ${errorText(e)}`))
      // A call that got no answer at all is logged but never replaces a saved answer: the page shows answers.
      if (run.error === null) runs.set(`${s.id}:${mode}`, run)
      const said = run.decision
        ? `${run.decision.option} ${run.decision.confidencePercent}%${run.problems.length ? ` REJECTED: ${run.problems.join('; ')}` : ''}`
        : `no answer: ${run.error}`
      console.log(`${s.id.padEnd(22)} ${mode.padEnd(4)} ${String(run.latencyMs).padStart(6)} ms  ${said}`)
    }
  }
} finally {
  await close()
}
const ordered = SITUATION_IDS.flatMap((id) =>
  (['raw', 'serv'] as const).flatMap((m) => runs.get(`${id}:${m}`) ?? []),
)
writeFileSync(FILE, `${JSON.stringify({ runs: ordered }, null, 2)}\n`)
console.log(`saved ${ordered.length} answers to ${FILE}`)

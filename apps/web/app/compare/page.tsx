import { APPROVED_TOKENS } from '@desk/chain'
import { type ComparisonRun, SITUATION_IDS, type SituationId, situations } from '@desk/core'
import { compareCopy } from '@desk/shared'
import saved from '@/data/compare.json'
import { ComparePage } from '@/features/compare/ComparePage'

export const metadata = { title: compareCopy.title, description: compareCopy.lead }

/**
 * With and without reasoning [8.20]. The answers were asked ahead of time by `pnpm compare:run` and saved with the
 * site, so the page is the same for every visitor and never calls a model: the website holds no key.
 */
export default async function Compare({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const { s } = await searchParams
  const selected: SituationId = SITUATION_IDS.includes(s as SituationId)
    ? (s as SituationId)
    : SITUATION_IDS[0]
  const runs = (saved as { runs: ComparisonRun[] }).runs.filter((r) => r.situation === selected)
  return (
    <ComparePage
      situations={situations(APPROVED_TOKENS).map((x) => ({ id: x.id, userMessage: x.pack.userMessage }))}
      selected={selected}
      runs={{ raw: runs.find((r) => r.mode === 'raw'), serv: runs.find((r) => r.mode === 'serv') }}
    />
  )
}

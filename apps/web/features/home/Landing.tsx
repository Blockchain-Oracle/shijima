import { settingsCopy } from '@desk/shared'
import { headers } from 'next/headers'
import { isOutcome, outcomeLabel } from '@/components/outcome'
import { publicAgents } from '@/lib/agents.server'
import { currentDeployment } from '@/lib/chain'
import { currentVaultRateBps, loadDesk } from '@/lib/desk.server'
import { liveStats } from '@/lib/live.server'
import { loadWeekendFact, presetPerformance } from '@/lib/markets.server'
import { signedInAddress } from '@/lib/session'
import { tickerCells } from '@/lib/shell.server'
import { LandingPage } from './landing/LandingPage'

/** The shared agent the landing shows at work: "Shijima's own", live on mainnet with real money, shared read-only. */
const SHOWCASE_SLUG = 'showcase'

/** This site's own address, for the QR code that opens it on a phone. */
async function siteOrigin(): Promise<string> {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/$/, '')
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3007'
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')
  return `${proto}://${host}`
}

/**
 * The landing page with its live data, for `/` (visitors) and `/home` (everyone, always). Every number on it
 * comes from here: nothing on the landing is typed in by hand.
 */
export async function Landing() {
  const [signedIn, showcase, agents, weekendFact, performance, vaultRateBps, stats, prices, origin] =
    await Promise.all([
      signedInAddress()
        .then(Boolean)
        .catch(() => false),
      loadDesk(SHOWCASE_SLUG).catch(() => undefined),
      publicAgents().catch(() => []),
      loadWeekendFact().catch(() => null),
      presetPerformance(30).catch(() => []),
      currentVaultRateBps().catch(() => null),
      liveStats().catch(() => null),
      tickerCells().catch(() => []),
      siteOrigin(),
    ])
  const bot = process.env.TELEGRAM_BOT_USERNAME ?? settingsCopy.telegram.bot
  const latest = showcase?.agent.latest
  const recent = (showcase?.record ?? [])
    .flatMap((r) => (r.kind === 'entry' ? [r.decision] : []))
    .slice(0, 4)
    .map((d) => ({ seq: d.seq, outcome: outcomeLabel(d.outcome), summary: d.summary }))
  return (
    <LandingPage
      signedIn={signedIn}
      showcase={showcase ? { slug: showcase.slug, address: showcase.desk.address, recent } : null}
      latest={
        latest
          ? {
              outcome: isOutcome(latest.outcome) ? outcomeLabel(latest.outcome) : '',
              summary: latest.summary,
            }
          : null
      }
      agents={agents}
      weekendFact={weekendFact}
      performance={performance}
      vaultRateBps={vaultRateBps}
      stats={stats ? { trades: stats.trades, movedUsdg: stats.movedUsdg } : null}
      prices={prices}
      factory={currentDeployment().factory}
      origin={origin}
      bot={bot}
    />
  )
}

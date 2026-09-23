import { marketsCopy, moneyCopy } from '@desk/shared'
import { formatUnits } from 'viem'
import { SignedOutCard } from '@/features/money/SignedOutCard'
import { WalletHome, type WalletView } from '@/features/wallet/WalletHome'
import { loadOverview } from '@/lib/overview.server'
import { signedInAddress } from '@/lib/session'
import { loadWallet, recentActivity, type WalletHolding } from '@/lib/wallet.server'

export const dynamic = 'force-dynamic'
export const metadata = { title: moneyCopy.wallet.meta }

const TRADED = new Set(['acted', 'acted_in_part', 'acted_by_override'])

const dollars = (raw: bigint | null) => (raw === null ? null : Number(raw) / 1e6)

/** A holding's amount as a person reads it: cents for USDG, a few places for ETH and shares. */
function amountOf(h: WalletHolding): string {
  const n = Number(formatUnits(h.displayRaw, h.decimals))
  const places = h.kind === 'usdg' ? 2 : h.kind === 'eth' ? 5 : 4
  return n.toLocaleString('en-US', {
    minimumFractionDigits: h.kind === 'usdg' ? 2 : 0,
    maximumFractionDigits: places,
  })
}

/**
 * The signed-in home (W1): your agents' money and your own wallet, both read from the chain at the moment you
 * look, with what they did and what waits on you.
 */
export default async function WalletPage() {
  const address = await signedInAddress().catch(() => undefined)
  if (!address) return <SignedOutCard />
  const [w, activity, overview] = await Promise.all([
    loadWallet(address),
    recentActivity(address, 12),
    loadOverview(address),
  ])

  const view: WalletView = {
    address,
    wallet: w.wallet
      ? {
          holdings: w.wallet.holdings.map((h) => ({
            kind: h.kind,
            symbol: h.symbol,
            name: h.name,
            amount: amountOf(h),
            valueUsd: dollars(h.valueUsdg),
          })),
          totalUsd: Number(w.wallet.totalUsdg) / 1e6,
        }
      : null,
    agents: w.agents.map((a) => {
      const stocks = a.stocks.reduce((s, h) => s + (h.valueUsdg ?? 0n), 0n)
      return {
        id: a.id,
        slug: a.slug,
        name: a.name,
        mode: a.mode,
        state: a.state,
        cashUsd: Number(a.cashUsdg) / 1e6,
        savingsUsd: Number(a.savingsUsdg) / 1e6,
        stocksUsd: Number(stocks) / 1e6,
        totalUsd: Number(a.totalUsdg) / 1e6,
        symbols: a.symbols,
        changePct: a.changeBps === null ? null : a.changeBps / 100,
        needsYou: a.needsYou,
        latest: a.latest
          ? { summary: a.latest.summary, outcome: a.latest.outcome, at: a.latest.at.toISOString() }
          : null,
        checked: a.checkedAt !== null,
      }
    }),
    agentsTotalUsd: Number(w.agentsTotalUsdg) / 1e6,
    unpriced: w.unpriced,
    activity: activity.map((a) => {
      // A decision that moved nothing (practice, waited, declined) is never "done" and carries no amount.
      const practice = a.kind === 'decision' && a.detail.includes('practice')
      const traded = a.kind === 'move' || (TRADED.has(a.subkind) && !practice)
      return {
        kind: a.kind,
        title: a.title,
        detail: a.detail,
        amountUsd: traded ? dollars(a.amountUsdg) : null,
        status: traded ? a.status : ('quiet' as const),
        label: traded ? undefined : (marketsCopy.outcomes[a.subkind] ?? a.subkind).toUpperCase(),
        href: a.href,
        at: a.at.toISOString(),
        agentName: a.agentName,
      }
    }),
    needs: overview.needs.length,
    combined: overview.combined,
  }
  return <WalletHome view={view} />
}

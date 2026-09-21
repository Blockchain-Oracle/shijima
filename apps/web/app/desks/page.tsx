import { deskRecord, desksOfOwner, GO_LIVE_CHECKS, pendingApprovals } from '@desk/db'
import { ago, engineCopy, money, percent } from '@desk/shared'
import Link from 'next/link'
import { Answer } from '@/components/answer'
import { Outcome } from '@/components/outcome'
import { Pause } from '@/components/pause'
import { db } from '@/lib/db'
import { signedInAddress } from '@/lib/session'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Your desks' }

const MODES = { shadow: 'Practice', ask_first: 'Ask first', on_its_own: 'On its own' } as const

/**
 * The owner's own view. It shows the one thing a desk ever needs from its owner: an answer.
 *
 * Nothing here moves money. Answering records an answer, and the worker re-reads the price on its next check.
 */
export default async function MyDesks() {
  const address = await signedInAddress()
  if (!address) {
    return (
      <div className="max-w-xl space-y-3">
        <h1 className="font-semibold text-2xl tracking-tight">Your desks</h1>
        <p className="text-ink-soft">
          Connect your wallet and sign in above to see them. Signing costs nothing and moves nothing.
        </p>
      </div>
    )
  }

  const desks = await desksOfOwner(db(), address)
  if (desks.length === 0) {
    return (
      <div className="max-w-xl space-y-3">
        <h1 className="font-semibold text-2xl tracking-tight">Your desks</h1>
        <p className="text-ink-soft">
          This wallet does not own a desk yet. A desk is an account on the network that only you can withdraw
          from, and an assistant that looks after it inside limits you set.
        </p>
      </div>
    )
  }

  const now = new Date()
  const loaded = await Promise.all(
    desks.map(async (desk) => ({
      desk,
      waiting: await pendingApprovals(db(), desk.id),
      recent: await deskRecord(db(), desk.id, { limit: 3 }),
    })),
  )

  return (
    <div className="space-y-8">
      <h1 className="font-semibold text-2xl tracking-tight">Your desks</h1>
      {loaded.map(({ desk, waiting, recent }) => {
        const newest = recent[0]
        const valuation = (newest?.record as { valuation?: { totalUsdg: string } } | undefined)?.valuation
        return (
          <section key={desk.id} className="space-y-4 rounded-lg border border-line bg-surface p-4">
            <header className="flex flex-wrap items-baseline justify-between gap-3">
              <div>
                <h2 className="font-medium text-lg">{desk.name ?? 'Your desk'}</h2>
                <p className="text-ink-soft text-sm">
                  {MODES[desk.mode]} · {engineCopy.deskState[desk.state]}
                  {valuation ? ` · worth ${money(valuation.totalUsdg)}` : ''}
                </p>
              </div>
              {desk.shareSlug ? (
                <Link href={`/desk/${desk.shareSlug}`} className="text-accent text-sm hover:underline">
                  The public view →
                </Link>
              ) : null}
            </header>

            {desk.stateReason ? <p className="text-blocked text-sm">{desk.stateReason}</p> : null}

            <div className="space-y-3">
              <h3 className="font-medium text-ink-soft text-sm uppercase tracking-wide">
                {waiting.length === 0 ? 'Nothing needs you' : 'Waiting for you'}
              </h3>
              {waiting.map((a) => {
                const shown = a.preview as { amountIn?: string; expectedOut?: string }
                return (
                  <div key={a.id} className="space-y-2 rounded-md border border-waited p-3">
                    <p className="text-sm">{a.summary}</p>
                    <p className="tabular text-ink-soft text-sm">
                      {a.side === 'sell' ? 'Sell' : 'Buy'} {shown.amountIn ?? '?'} for about{' '}
                      {shown.expectedOut ?? '?'}
                      {a.reason === 'large_action' ? ' · asking because this one is large' : ''}
                    </p>
                    <Answer deskId={desk.id} approvalId={a.id} expiresAt={a.expiresAt.toISOString()} />
                  </div>
                )
              })}
              {waiting.length === 0 ? (
                <p className="text-ink-soft text-sm">
                  {newest
                    ? `Last check ${ago(newest.decidedAt, now)}: ${newest.summary}`
                    : 'It has not checked yet.'}
                </p>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-3 border-line border-t pt-3">
              <Pause deskId={desk.id} paused={desk.state === 'paused_by_owner'} />
              {desk.mode === 'shadow' ? (
                <span className="text-ink-faint text-xs">
                  {Math.min(desk.shadowChecks, GO_LIVE_CHECKS)} of {GO_LIVE_CHECKS} practice checks done ·{' '}
                  {desk.shadowReportOpenedAt ? 'report read' : 'report not read yet'}
                  {desk.shadowChecks >= GO_LIVE_CHECKS && desk.shadowReportOpenedAt
                    ? ' · it can go live when you choose'
                    : ''}
                </span>
              ) : null}
            </div>

            {recent.length > 0 ? (
              <ul className="space-y-1 border-line border-t pt-3">
                {recent.map((d) => (
                  <li key={d.id} className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="text-ink-soft">{d.summary}</span>
                    <span className="shrink-0">
                      <Outcome outcome={d.outcome} shadow={d.shadow} />
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
            {desk.mode === 'shadow' ? (
              <p className="text-ink-faint text-xs">
                In practice mode the desk decides for real and spends nothing. {percent(0)} of your money has
                moved.
              </p>
            ) : null}
          </section>
        )
      })}
    </div>
  )
}

import { APPROVED_TOKENS } from '@desk/chain'
import { deskRecord, desksOfOwner, GO_LIVE_CHECKS, pendingApprovals, telegramForDesk } from '@desk/db'
import { ago, desksCopy as c, deskCopy, engineCopy, money, until } from '@desk/shared'
import type { Route } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Answer } from '@/components/answer'
import { Outcome } from '@/components/outcome'
import { Pause } from '@/components/pause'
import { db } from '@/lib/db'
import { signedInAddress } from '@/lib/session'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Your desks' }

const nameOf = (token: string | null) =>
  (token && APPROVED_TOKENS.find((t) => t.address.toLowerCase() === token.toLowerCase())?.displayName) ??
  token ??
  ''

/**
 * The owner's own view. It shows the one thing a desk ever needs from its owner: an answer.
 *
 * Nothing here moves money. Answering records an answer, and the worker re-reads the price on its next check.
 */
export default async function MyDesks() {
  const address = await signedInAddress()
  if (!address) {
    return (
      <div className="container desk-page">
        <header className="desk-hero">
          <h1 className="type-headline text-ink">{c.title}</h1>
          <p className="type-body text-ink-secondary">{c.signIn}</p>
        </header>
      </div>
    )
  }

  const desks = await desksOfOwner(db(), address)
  if (desks.length === 0) {
    return (
      <div className="container desk-page">
        <header className="desk-hero">
          <h1 className="type-headline text-ink">{c.title}</h1>
          <p className="type-body text-ink-secondary">{c.none}</p>
          <Link href={'/strategies' as Route} className="type-caption text-accent hover:underline">
            {c.makeOne}
          </Link>
        </header>
      </div>
    )
  }

  // One desk: go straight to it, where the chat is first. The list is for owners of more than one.
  const [only] = desks
  if (only && desks.length === 1) redirect(`/desk/${only.shareSlug ?? only.id}` as Route)

  const now = new Date()
  const loaded = await Promise.all(
    desks.map(async (desk) => ({
      desk,
      waiting: await pendingApprovals(db(), desk.id),
      recent: await deskRecord(db(), desk.id, { limit: 3 }),
      telegram: await telegramForDesk(db(), desk.id),
    })),
  )

  return (
    <div className="container desk-page">
      <header className="desk-hero">
        <h1 className="type-headline text-ink">{c.title}</h1>
      </header>
      {loaded.map(({ desk, waiting, recent, telegram }) => {
        const newest = recent[0]
        const valuation = (newest?.record as { valuation?: { totalUsdg: string } } | undefined)?.valuation
        const home = `/desk/${desk.shareSlug ?? desk.id}` as Route
        return (
          <section key={desk.id} className="desk-panel">
            <header className="desk-panel-head">
              <div>
                <h2 className="type-title text-ink">
                  <Link href={home} className="hover:underline">
                    {desk.name ?? 'Your desk'}
                  </Link>
                </h2>
                <p className="type-caption text-ink-secondary">
                  {deskCopy.modes[desk.mode]} · {engineCopy.deskState[desk.state]}
                  {valuation ? ` · ${c.worth(money(valuation.totalUsdg))}` : ''}
                </p>
              </div>
              <span className="flex gap-3 type-caption">
                <Link href={home} className="text-accent hover:underline">
                  {c.open}
                </Link>
              </span>
            </header>

            {desk.stateReason ? <p className="type-caption text-warning">{desk.stateReason}</p> : null}

            <div className="flex flex-col gap-2">
              <h3 className="type-label-micro text-ink-muted">
                {waiting.length === 0 ? c.nothing : c.waiting}
              </h3>
              {waiting.map((a) => {
                const shown = a.preview as { amountIn?: string; expectedOut?: string }
                return (
                  <div key={a.id} className="desk-card">
                    <p className="type-body text-ink">{a.summary}</p>
                    <p className="type-data text-ink-secondary">
                      {deskCopy.needsYou.trade(
                        a.side ?? 'buy',
                        shown.amountIn ?? '?',
                        shown.expectedOut ?? '?',
                        nameOf(a.token),
                      )}
                      {a.reason === 'large_action' ? c.large : ''}
                    </p>
                    <p className="type-caption text-ink-muted">
                      {deskCopy.needsYou.expires(until(a.expiresAt, now))}
                    </p>
                    <Answer deskId={desk.id} approvalId={a.id} expiresAt={a.expiresAt.toISOString()} />
                  </div>
                )
              })}
              {waiting.length === 0 ? (
                <p className="type-caption text-ink-secondary">
                  {newest ? c.lastCheck(ago(newest.decidedAt, now), newest.summary) : c.notChecked}
                </p>
              ) : null}
              {!telegram.linked && <p className="type-caption text-ink-muted">{c.telegramOff}</p>}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Pause deskId={desk.id} paused={desk.state === 'paused_by_owner'} />
              {desk.mode === 'shadow' ? (
                <span className="type-caption text-ink-muted">
                  {c.practiceLine(desk.shadowChecks, GO_LIVE_CHECKS, desk.shadowReportOpenedAt !== null)}
                  {desk.shadowChecks >= GO_LIVE_CHECKS && desk.shadowReportOpenedAt ? c.ready : ''}
                </span>
              ) : null}
            </div>

            {recent.length > 0 ? (
              <ul className="flex flex-col gap-1">
                {recent.map((d) => (
                  <li key={d.id} className="flex items-baseline justify-between gap-3 type-caption">
                    <span className="text-ink-secondary">{d.summary}</span>
                    <span className="shrink-0">
                      <Outcome outcome={d.outcome} shadow={d.shadow} />
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
            {desk.mode === 'shadow' ? <p className="type-caption text-ink-muted">{c.practiceNote}</p> : null}
          </section>
        )
      })}
    </div>
  )
}

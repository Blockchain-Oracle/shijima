'use client'

import { moneyCopy } from '@desk/shared'
import type { Route } from 'next'
import { useRouter } from 'next/navigation'
import type { ReactNode } from 'react'
import { Button, Callout, FlowCard, MoveRun, type RunEnding, type Step } from '@/components/kit'
import {
  type QuoteState,
  quoteRows,
  RouteSummary,
  type SummaryRow,
  useLiveQuote,
} from '@/components/kit/ticket'
import { SignInButton } from '@/components/shell/SignInButton'
import type { MoveEnding, MoveInput } from '@/lib/money/types'
import { useMove } from './useMove'

const ENDING: Record<MoveEnding, RunEnding> = {
  done: 'done',
  nothing_sent: 'nothingSent',
  approved_only: 'approvedOnly',
  on_its_way: 'onItsWay',
  may_have_been_sent: 'maybeSent',
}

export interface RouteEnds {
  from: { chainId: number; label: string }
  to: { chainId: number; label: string }
}

/**
 * One money move on two panels. On the left the ticket: what you pay and what arrives, with the live quote. On the
 * right the summary: the route, what it costs and how long it takes, then Review; after Review the exact lines to
 * sign; then the run with its real steps and one of five honest endings. The server plans it, the owner's wallet
 * signs it, and the chain (or Relay) says how it ended. Stacks into one column on narrow screens.
 */
export function MoveFlow({
  title,
  icon,
  badge,
  owner,
  input,
  ticket,
  route,
  invalid,
  reviewLabel,
  doneTitle,
  after,
  aside,
  extraRows,
}: {
  title: string
  icon: ReactNode
  badge?: ReactNode
  owner: string
  /** The move the ticket describes, or null while it is not complete. */
  input: MoveInput | null
  /** The left panel, given the live quote so it can show what arrives. */
  ticket: (quote: QuoteState) => ReactNode
  route: RouteEnds
  /** Why Review is not possible yet. */
  invalid?: string | null
  reviewLabel: string
  doneTitle: string
  /** Offered after a move is done. */
  after?: ReactNode
  /** Under the summary: more context for this screen. */
  aside?: ReactNode
  /** Rows the screen adds to the summary, such as the recipient. */
  extraRows?: SummaryRow[]
}) {
  const router = useRouter()
  const move = useMove({ owner })
  const s = move.state
  const c = moneyCopy.flow
  const t = moneyCopy.ticket
  const editing = s.phase !== 'ready' && s.phase !== 'running' && s.phase !== 'finished'
  const quote = useLiveQuote(editing && !invalid ? input : null)

  let side: ReactNode
  if (s.phase === 'running' || s.phase === 'finished') {
    const plan = s.plan
    const steps: Step[] = (plan?.steps ?? []).map((step, index) => {
      const at = s.step?.index ?? (s.phase === 'finished' ? (plan?.steps.length ?? 0) : 0)
      const state =
        s.phase === 'finished'
          ? s.outcome?.ending === 'done' || s.outcome?.ending === 'on_its_way'
            ? 'done'
            : index < (s.outcome?.links.length ?? 0)
              ? 'done'
              : 'pending'
          : index < at
            ? 'done'
            : index === at
              ? 'active'
              : 'pending'
      return { label: step.label, state }
    })
    if (plan?.relayRequestId) {
      steps.push({
        label: c.relayFills,
        state:
          s.outcome?.ending === 'done' ? 'done' : s.outcome?.ending === 'on_its_way' ? 'active' : 'pending',
      })
    }
    const links = [
      ...(s.outcome?.links ?? []).map((l) => ({ label: c.viewTx, href: l.url })),
      ...(s.outcome?.relayUrl ? [{ label: c.viewRelay, href: s.outcome.relayUrl }] : []),
    ]
    side = (
      <FlowCard icon={icon} title={doneTitle}>
        <MoveRun
          steps={steps}
          {...(s.phase === 'finished' && s.outcome && s.outcome.ending !== 'signing'
            ? { ending: ENDING[s.outcome.ending] }
            : {})}
          error={s.outcome?.text ?? null}
          links={links}
          copy={{ hint: c.hint, doneTitle, doneBody: s.outcome?.text ?? '', failedTitle: c.nothingSent }}
          onDone={() => move.reset()}
          onActivity={() => router.push('/activity' as Route)}
          onRetry={() => move.reset()}
          extra={after}
        />
      </FlowCard>
    )
  } else if (s.phase === 'ready' && s.plan) {
    side = (
      <FlowCard icon={icon} title={t.summary}>
        <div className="kit-summary">
          <dl className="kit-summary-rows">
            {s.plan.lines.map((line, i) => (
              <div key={line} data-strong={i === 0 || undefined}>
                <dt style={{ color: i === 0 ? 'var(--tx)' : 'var(--tx2)', lineHeight: 1.45 }}>{line}</dt>
              </div>
            ))}
          </dl>
        </div>
        {s.problem ? <Callout tone="warn">{s.problem}</Callout> : null}
        <Callout tone="wallet" title={c.signTitle(s.plan.steps.length)}>
          {c.signBody}
        </Callout>
        <div style={{ display: 'flex', gap: 10 }}>
          <Button variant="secondary" onClick={() => move.reset()}>
            {c.back}
          </Button>
          <Button fullWidth onClick={() => void move.run()} disabled={!move.walletReady}>
            {move.walletReady ? c.confirm : c.connectFirst}
          </Button>
        </div>
      </FlowCard>
    )
  } else {
    const problem = s.problem ?? quote.why
    const hint = s.hint ?? quote.hint
    side = (
      <FlowCard icon={icon} title={t.summary}>
        <RouteSummary
          from={route.from}
          to={route.to}
          rows={[...quoteRows(quote.quote), ...(quote.quote ? (extraRows ?? []) : [])]}
          loading={quote.loading}
          empty={t.summaryEmpty}
        />
        {problem ? (
          <Callout tone="warn">
            {problem}
            {hint?.kind === 'use_fund' && hint.deskSlug ? (
              <>
                {' '}
                <a href={`/fund?agent=${hint.deskSlug}`} style={{ color: 'var(--warn)', fontWeight: 700 }}>
                  {c.useFund} →
                </a>
              </>
            ) : null}
          </Callout>
        ) : invalid ? (
          <Callout tone="warn">{invalid}</Callout>
        ) : null}
        {move.walletReady ? null : (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              flexWrap: 'wrap',
              fontSize: 12,
              color: 'var(--tx3)',
            }}
          >
            {c.connectToSign} <SignInButton />
          </div>
        )}
        <Button
          fullWidth
          disabled={!input || Boolean(invalid) || Boolean(quote.why)}
          loading={s.phase === 'planning'}
          onClick={() => input && void move.plan(input)}
        >
          {s.phase === 'planning' ? c.pricing : reviewLabel}
        </Button>
      </FlowCard>
    )
  }

  return (
    <div className="kit-money">
      <FlowCard icon={icon} title={title} badge={badge}>
        <div
          className={editing ? 'kit-ticket' : 'kit-ticket kit-money-locked'}
          aria-disabled={!editing || undefined}
        >
          {ticket(quote)}
        </div>
      </FlowCard>
      <div className="kit-money-side">
        {side}
        {aside}
      </div>
    </div>
  )
}

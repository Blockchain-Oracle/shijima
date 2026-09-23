'use client'

import { moneyCopy } from '@desk/shared'
import type { Route } from 'next'
import { useRouter } from 'next/navigation'
import type { ReactNode } from 'react'
import { Button, Callout, FlowCard, MoveRun, type RunEnding, type Step } from '@/components/kit'
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

/**
 * One money move, stepped the way the reference wallet steps a shield (ShieldScreen.tsx:187-290): the amount,
 * then a review of exactly what happens, then the run with its real steps, then one of five honest endings. The
 * screen supplies the form and the move it describes; the server plans it, the owner's wallet signs it, and the
 * chain (or Relay) says how it ended.
 */
export function MoveFlow({
  title,
  icon,
  badge,
  owner,
  input,
  form,
  invalid,
  reviewLabel,
  doneTitle,
  after,
}: {
  title: string
  icon: ReactNode
  badge?: ReactNode
  owner: string
  /** The move the form describes, or null while it is not complete. */
  input: MoveInput | null
  form: ReactNode
  /** Why Review is not possible yet, shown under the form. */
  invalid?: string | null
  reviewLabel: string
  doneTitle: string
  /** Offered after a move is done: Send on, Bridge out. */
  after?: ReactNode
}) {
  const router = useRouter()
  const move = useMove({ owner })
  const s = move.state
  const c = moneyCopy.flow

  let body: ReactNode
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
    body = (
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
    )
  } else if (s.phase === 'ready' && s.plan) {
    body = (
      <>
        <div
          style={{
            border: '1px solid var(--bd)',
            borderRadius: 14,
            background: 'var(--card)',
            padding: '4px 16px',
          }}
        >
          {s.plan.lines.map((line, i) => (
            <div
              key={line}
              style={{
                padding: '12px 0',
                borderTop: i === 0 ? 'none' : '1px solid var(--bd)',
                fontSize: 13,
                color: i === 0 ? 'var(--tx)' : 'var(--tx2)',
                fontWeight: i === 0 ? 600 : 400,
              }}
            >
              {line}
            </div>
          ))}
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
      </>
    )
  } else {
    body = (
      <>
        {form}
        {s.problem ? (
          <Callout tone="warn">
            {s.problem}
            {s.hint?.kind === 'use_fund' && s.hint.deskSlug ? (
              <>
                {' '}
                <a href={`/fund?agent=${s.hint.deskSlug}`} style={{ color: 'var(--warn)', fontWeight: 700 }}>
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
          disabled={!input || Boolean(invalid)}
          loading={s.phase === 'planning'}
          onClick={() => input && void move.plan(input)}
        >
          {s.phase === 'planning' ? c.pricing : reviewLabel}
        </Button>
      </>
    )
  }

  return (
    <FlowCard icon={icon} title={title} badge={badge}>
      {body}
    </FlowCard>
  )
}

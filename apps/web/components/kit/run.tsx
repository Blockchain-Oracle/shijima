'use client'

import type { CSSProperties, ReactNode } from 'react'
import { Button } from './button'
import { Callout, truncateMiddle } from './primitives'
import { ProgressRing, type RingState, type Step, StepList } from './proving'

/**
 * The reference wallet's ProofRun (apps/web/src/wallet/ProofRun.tsx), for money moves instead of proofs. While a move
 * runs: the ring and the real steps. When it settles, one of five honest endings, never a cheerful guess:
 *   done           the chain (or Relay) confirmed it
 *   nothingSent    you declined, or it was refused before anything was signed
 *   approvedOnly   the approval went through, the move itself did not: nothing moved
 *   onItsWay       sent on the first network, Relay is still filling it
 *   maybeSent      a transaction exists but we could not confirm it: check the explorer before trying again
 */

export type RunEnding = 'done' | 'nothingSent' | 'approvedOnly' | 'onItsWay' | 'maybeSent'

export interface RunLink {
  readonly label: string
  readonly href: string
}

export interface RunCopy {
  readonly hint: string
  readonly doneTitle: string
  readonly doneBody: ReactNode
  readonly failedTitle: string
}

const ENDING: Record<
  Exclude<RunEnding, 'done'>,
  { title: string; callout: string; glyph: string; tone: 'warn' | 'info' }
> = {
  nothingSent: { title: 'Nothing was sent', callout: 'No money moved.', glyph: '!', tone: 'warn' },
  approvedOnly: {
    title: 'Approved, not moved',
    callout: 'Your wallet approved the amount, but the move itself did not happen. No money moved.',
    glyph: '⏳',
    tone: 'warn',
  },
  onItsWay: {
    title: 'On its way',
    callout: 'Sent on the first network. Relay is filling it; this usually takes under a minute.',
    glyph: '⇄',
    tone: 'info',
  },
  maybeSent: {
    title: 'May have been sent',
    callout:
      'A transaction exists but we could not confirm it. Check it on the explorer before trying again.',
    glyph: '?',
    tone: 'warn',
  },
}

function Links({ links }: { links: readonly RunLink[] }) {
  if (links.length === 0) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
      {links.map((l) => (
        <a
          key={l.href}
          href={l.href}
          target="_blank"
          rel="noreferrer noopener"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 12,
            color: 'var(--ac2)',
            fontWeight: 600,
          }}
        >
          {l.label} ↗
          <span style={{ fontFamily: 'var(--fm)', color: 'var(--tx3)' }}>
            {truncateMiddle(l.href.split('/').pop() ?? '', 6, 6)}
          </span>
        </a>
      ))}
    </div>
  )
}

export function MoveRun({
  steps,
  ending,
  error,
  links = [],
  copy,
  onDone,
  onActivity,
  onRetry,
  extra,
}: {
  steps: readonly Step[]
  /** Undefined while running. */
  ending?: RunEnding
  error?: string | null
  links?: readonly RunLink[]
  copy: RunCopy
  onDone: () => void
  onActivity: () => void
  onRetry: () => void
  /** Offered after done: Send on, Bridge out. */
  extra?: ReactNode
}) {
  const center: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    gap: 16,
  }

  if (ending === 'done') {
    return (
      <div style={{ ...center, padding: '24px 0' }}>
        <div
          className="animate-kitPop"
          style={{
            width: 74,
            height: 74,
            borderRadius: '50%',
            display: 'grid',
            placeItems: 'center',
            background: 'color-mix(in srgb, var(--pos) 12%, transparent)',
            border: '1px solid color-mix(in srgb, var(--pos) 42%, transparent)',
            color: 'var(--pos)',
            fontSize: 34,
          }}
        >
          ✓
        </div>
        <div>
          <div style={{ fontSize: 21, fontWeight: 800, letterSpacing: '-.02em' }}>{copy.doneTitle}</div>
          <div style={{ marginTop: 8, maxWidth: 380, fontSize: 13, color: 'var(--tx2)', lineHeight: 1.6 }}>
            {copy.doneBody}
          </div>
        </div>
        <Links links={links} />
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            width: 260,
            maxWidth: '100%',
            marginTop: 6,
          }}
        >
          <Button fullWidth onClick={onDone}>
            Done
          </Button>
          <Button variant="secondary" fullWidth onClick={onActivity}>
            View in activity
          </Button>
          {extra}
        </div>
      </div>
    )
  }

  if (ending) {
    const e = ENDING[ending]
    const maybe = ending === 'maybeSent' || ending === 'onItsWay'
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={center}>
          <div
            style={{
              width: 70,
              height: 70,
              borderRadius: '50%',
              display: 'grid',
              placeItems: 'center',
              background: `color-mix(in srgb, ${e.tone === 'info' ? 'var(--ac)' : 'var(--warn)'} 12%, transparent)`,
              color: e.tone === 'info' ? 'var(--ac2)' : 'var(--warn)',
              fontSize: 28,
            }}
          >
            {e.glyph}
          </div>
          <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-.02em' }}>
            {ending === 'nothingSent' ? copy.failedTitle : e.title}
          </div>
        </div>
        <Callout tone={e.tone === 'info' ? 'info' : 'warn'} title={e.callout}>
          {error ?? ''}
        </Callout>
        <StepList steps={steps} />
        <Links links={links} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {maybe ? (
            <Button fullWidth onClick={onActivity}>
              Check activity
            </Button>
          ) : (
            <Button fullWidth onClick={onRetry}>
              Try again
            </Button>
          )}
          <Button variant="secondary" fullWidth onClick={onDone}>
            Back
          </Button>
        </div>
      </div>
    )
  }

  const done = steps.filter((s) => s.state === 'done').length
  const active = steps.find((s) => s.state === 'active')
  const state: RingState = steps.some((s) => s.state === 'error') ? 'error' : 'active'
  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, padding: '14px 0' }}
    >
      <ProgressRing
        progress={steps.length ? done / steps.length : 0}
        label={`${done}/${steps.length}`}
        state={state}
      />
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>{active ? `${active.label}…` : 'Working…'}</div>
        <div style={{ marginTop: 6, fontSize: 12, color: 'var(--tx3)' }}>{copy.hint}</div>
      </div>
      <div style={{ width: '100%', maxWidth: 340 }}>
        <StepList steps={steps} />
      </div>
    </div>
  )
}

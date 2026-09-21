'use client'

import { deskCopy, until } from '@desk/shared'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { confirmProposalAction } from '@/app/actions'
import { Button } from '@/components/ui/button'
import { ChainConfirm } from '@/features/session/ChainConfirm'
import { cn } from '@/lib/utils'
import type { ChatCard } from './chat-model'

/**
 * The card a proposal is shown on, in the shape of Masayume's `CapabilityReceipt`: what changes, before and
 * after, who signs, and when it expires. Only the saved proposal runs, and only after this Confirm.
 */
export function ProposalCard({ card }: { card: ChatCard }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [outcome, setOutcome] = useState<{ ok: boolean; text: string } | null>(
    card.status === 'done' || card.status === 'refused' || card.status === 'failed'
      ? { ok: card.status === 'done', text: card.result ?? '' }
      : null,
  )
  const [dismissed, setDismissed] = useState(false)
  const expired =
    card.status === 'expired' || (card.status === 'open' && new Date(card.expiresAt) < new Date())

  const confirm = () =>
    start(async () => {
      const result = await confirmProposalAction(card.id)
      setOutcome({ ok: result.ok, text: result.message })
      router.refresh()
    })

  return (
    <div className={cn('desk-card', outcome?.ok && 'is-done', (expired || dismissed) && 'is-quiet')}>
      <div className="desk-card-head">
        <span className="type-label-micro text-ink-muted">{deskCopy.card.who[card.path]}</span>
        <strong className="type-body-strong text-ink">{card.title}</strong>
      </div>
      {(card.before.length > 0 || card.after.length > 0) && (
        <dl className="desk-card-diff">
          {card.before.length > 0 && (
            <div>
              <dt>{deskCopy.card.before}</dt>
              {card.before.map((line) => (
                <dd key={`b-${line}`}>{line}</dd>
              ))}
            </div>
          )}
          {card.after.length > 0 && (
            <div>
              <dt>{deskCopy.card.after}</dt>
              {card.after.map((line) => (
                <dd key={`a-${line}`} className="text-ink">
                  {line}
                </dd>
              ))}
            </div>
          )}
        </dl>
      )}
      {card.note && <p className="type-caption text-ink-secondary">{card.note}</p>}

      {outcome ? (
        <p className={cn('type-caption', outcome.ok ? 'text-profit' : 'text-loss')}>
          {outcome.text || (outcome.ok ? deskCopy.card.done : deskCopy.card.refused)}
        </p>
      ) : expired ? (
        <p className="type-caption text-ink-muted">{deskCopy.card.expired}</p>
      ) : dismissed ? (
        <p className="type-caption text-ink-muted">{deskCopy.card.left}</p>
      ) : card.path === 'signin' ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={confirm} disabled={pending}>
            {pending ? deskCopy.card.confirming : deskCopy.card.confirm}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setDismissed(true)} disabled={pending}>
            {deskCopy.card.notNow}
          </Button>
          <span className="type-caption text-ink-muted">
            {deskCopy.card.expires(until(new Date(card.expiresAt)))}
          </span>
        </div>
      ) : (
        <ChainConfirm card={card} onOutcome={(ok, text) => setOutcome({ ok, text })} />
      )}
    </div>
  )
}

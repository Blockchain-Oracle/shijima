'use client'

import { deskCopy, until } from '@desk/shared'
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpFromLine,
  Check,
  Gauge,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { type ReactNode, useState, useTransition } from 'react'
import { confirmProposalAction } from '@/app/actions'
import { ChainConfirm } from '@/features/session/ChainConfirm'
import { cn } from '@/lib/utils'
import type { ChatCard } from './chat-model'

/** Kinds that take money out of the market or the assistant out of the account: drawn in the danger tone. */
const DANGER = new Set(['sell_everything', 'remove_assistant', 'close_desk'])

const ICON: Record<string, ReactNode> = {
  set_mode: <Gauge />,
  pause: <Pause />,
  resume: <Play />,
  unpause: <Play />,
  check_now: <RefreshCw />,
  set_chain_limits: <ShieldCheck />,
  withdraw: <ArrowUpFromLine />,
  add_money: <ArrowDownToLine />,
}

/**
 * A card to confirm, after 21st's Alert Dialog Layout (28277, centered): an icon in the action's tone, the title,
 * what changes (before, then after), and Not now / Confirm side by side. Used in the chat and in every control.
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

  const tone = DANGER.has(card.kind) ? 'danger' : 'accent'
  return (
    <div
      className={cn('pc', `pc--${tone}`, outcome?.ok && 'is-done', (expired || dismissed) && 'is-quiet')}
      data-tone={tone}
    >
      <div className="pc-head">
        <span className="pc-icon" aria-hidden="true">
          {outcome?.ok ? (
            <Check />
          ) : tone === 'danger' ? (
            <AlertTriangle />
          ) : (
            (ICON[card.kind] ?? <ShieldCheck />)
          )}
        </span>
        <div className="pc-titles">
          <strong>{card.title}</strong>
          <span>{deskCopy.card.who[card.path]}</span>
        </div>
      </div>

      {(card.before.length > 0 || card.after.length > 0) && (
        <div className="pc-diff">
          {card.before.length > 0 && (
            <div className="pc-col">
              <span className="pc-label">{deskCopy.card.before}</span>
              {card.before.map((line) => (
                <p key={`b-${line}`}>{line}</p>
              ))}
            </div>
          )}
          {card.before.length > 0 && card.after.length > 0 && (
            <ArrowRight className="pc-arrow" aria-hidden="true" />
          )}
          {card.after.length > 0 && (
            <div className="pc-col pc-col--after">
              <span className="pc-label">{deskCopy.card.after}</span>
              {card.after.map((line) => (
                <p key={`a-${line}`}>{line}</p>
              ))}
            </div>
          )}
        </div>
      )}
      {card.note && <p className="pc-note">{card.note}</p>}

      {outcome ? (
        <p className={cn('pc-outcome', outcome.ok ? 'is-ok' : 'is-bad')}>
          {outcome.text || (outcome.ok ? deskCopy.card.done : deskCopy.card.refused)}
        </p>
      ) : expired ? (
        <p className="pc-note">{deskCopy.card.expired}</p>
      ) : dismissed ? (
        <p className="pc-note">{deskCopy.card.left}</p>
      ) : card.path === 'signin' ? (
        <>
          <div className="pc-actions">
            <button type="button" className="pc-btn" onClick={() => setDismissed(true)} disabled={pending}>
              {deskCopy.card.notNow}
            </button>
            <button type="button" className="pc-btn pc-btn--confirm" onClick={confirm} disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              {pending ? deskCopy.card.confirming : deskCopy.card.confirm}
            </button>
          </div>
          <p className="pc-expires">{deskCopy.card.expires(until(new Date(card.expiresAt)))}</p>
        </>
      ) : (
        <ChainConfirm card={card} onOutcome={(ok, text) => setOutcome({ ok, text })} />
      )}
    </div>
  )
}

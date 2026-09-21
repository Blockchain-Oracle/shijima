'use client'

import type { ButtonKind } from '@desk/core'
import { controlsCopy as c, deskCopy } from '@desk/shared'
import type { Route } from 'next'
import Link from 'next/link'
import { useState, useTransition } from 'react'
import { proposeAction } from '@/app/owner-actions'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { BridgeIn } from './BridgeIn'
import { ControlFields, type ControlForm, type FormState } from './ControlForms'
import type { ChatCard } from './chat-model'
import { ProposalCard } from './ProposalCard'

export interface ControlsView {
  deskId: string
  slug: string
  address: string
  owner: string
  mode: 'shadow' | 'ask_first' | 'on_its_own'
  state: string
  lifecycle: string
  assistantRemoved: boolean
  shadowChecks: number
  goLiveChecks: number
  reportOpened: boolean
  cashUsdg: string | null
  perActionCapUsdg: string | null
  dailyCapUsdg: string | null
}

/** Which card each form asks for, the owner's words for the thread, and the fields the checks read. */
function request(
  form: ControlForm,
  f: FormState,
): { kind: ButtonKind; words: string; fields: Record<string, string | null> } {
  switch (form) {
    case 'addMoney':
      return { kind: 'add_money', words: c.words.addMoney(f.amount), fields: { amountUsdg: f.amount } }
    case 'withdraw':
      return f.everything
        ? {
            kind: 'withdraw',
            words: c.words.withdrawAll(f.asStocks),
            fields: { withdrawAs: f.asStocks ? 'stocks' : 'usdg' },
          }
        : {
            kind: 'withdraw',
            words: c.words.withdraw(f.amount),
            fields: { amountUsdg: f.amount, withdrawAs: 'usdg' },
          }
    case 'sellAll':
      return { kind: 'sell_everything', words: c.words.sellAll, fields: {} }
    case 'pause':
      return { kind: 'pause', words: c.words.pause, fields: {} }
    case 'resume':
      return { kind: 'resume', words: c.words.resume, fields: {} }
    case 'mode':
      return { kind: 'set_mode', words: c.words.mode(deskCopy.modes[f.mode]), fields: { mode: f.mode } }
    case 'limits':
      return {
        kind: 'set_chain_limits',
        words: c.words.limits,
        fields: { perActionCapUsdg: f.perAction || null, dailyCapUsdg: f.daily || null },
      }
    case 'checkNow':
      return { kind: 'check_now', words: c.words.checkNow, fields: {} }
    case 'remove':
      return { kind: 'remove_assistant', words: c.words.removeAssistant, fields: {} }
    case 'restart':
      return { kind: 'unpause', words: c.words.restart, fields: {} }
    case 'closeDesk':
      return {
        kind: 'close_desk',
        words: c.words.closeDesk(f.asStocks),
        fields: { withdrawAs: f.asStocks ? 'stocks' : 'usdg' },
      }
  }
}

const HEADINGS: Record<ControlForm, { eyebrow: string; title: string; body: string }> = {
  addMoney: c.addMoney,
  withdraw: c.withdraw,
  sellAll: c.sellAll,
  pause: c.pause,
  resume: { eyebrow: c.pause.eyebrow, title: c.pause.resumeTitle, body: c.pause.resumeBody },
  mode: { ...c.mode, body: '' },
  limits: c.limits,
  checkNow: c.check,
  remove: c.remove,
  restart: c.restart,
  closeDesk: c.closeDesk,
}

/** One control's dialog: its form, then the card it made, confirmed right there. */
export function ControlDialog({
  view,
  form,
  onClose,
}: {
  view: ControlsView
  form: ControlForm | null
  onClose: () => void
}) {
  const [state, setState] = useState<FormState>({
    amount: '',
    everything: false,
    asStocks: false,
    mode: view.mode,
    perAction: '',
    daily: '',
  })
  const [card, setCard] = useState<ChatCard | null>(null)
  const [why, setWhy] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const close = () => {
    setCard(null)
    setWhy(null)
    onClose()
  }
  if (!form) return null
  const head = HEADINGS[form]

  const review = () =>
    start(async () => {
      setWhy(null)
      const r = request(form, state)
      const made = await proposeAction({ deskId: view.deskId, ...r })
      if (made.ok) setCard(made.card)
      else setWhy(made.why)
    })

  return (
    <Modal
      open
      onClose={close}
      eyebrow={head.eyebrow}
      title={head.title}
      description={head.body || undefined}
      closeLabel={c.close}
    >
      {card ? (
        <ProposalCard card={card} />
      ) : (
        <>
          <ControlFields form={form} view={view} state={state} onChange={setState} />
          {why && <p className="type-caption text-loss">{why}</p>}
          <Button onClick={review} disabled={pending || (form === 'mode' && state.mode === view.mode)}>
            {pending ? c.reviewing : c.review}
          </Button>
          {/* The second way in: dollars from another network, straight into the desk through Relay. */}
          {form === 'addMoney' && (
            <BridgeIn desk={view.address as `0x${string}`} owner={view.owner as `0x${string}`} />
          )}
        </>
      )}
    </Modal>
  )
}

/** The buttons beside the chat. Each one makes the same card the chat would, and nothing happens until it is confirmed. */
export function DeskControls({ view }: { view: ControlsView }) {
  const [open, setOpen] = useState<ControlForm | null>(null)
  if (view.lifecycle === 'closed') {
    return (
      <section className="desk-panel">
        <h2 className="type-label-micro text-ink-muted">{c.title}</h2>
        <p className="type-body text-ink-secondary">{c.closed}</p>
      </section>
    )
  }
  const paused = view.state === 'paused_by_owner'
  const buttons: [ControlForm, string][] = [
    ['addMoney', c.actions.addMoney],
    ['withdraw', c.actions.withdraw],
    ['sellAll', c.actions.sellAll],
    paused ? ['resume', c.actions.resume] : ['pause', c.actions.pause],
    ['mode', c.actions.mode],
    ['limits', c.actions.limits],
    ['checkNow', c.actions.checkNow],
    view.assistantRemoved ? ['restart', c.actions.restart] : ['remove', c.actions.removeAssistant],
  ]
  return (
    <section className="desk-panel">
      <header className="desk-panel-head">
        <h2 className="type-label-micro text-ink-muted">{c.title}</h2>
        <Link
          href={`/desk/${view.slug}/settings` as Route}
          className="type-caption text-ink-secondary hover:text-ink"
        >
          {deskCopy.settingsLink} →
        </Link>
      </header>
      <p className="type-caption text-ink-muted">{c.intro}</p>
      <div className="desk-controls">
        {buttons.map(([form, label]) => (
          <button
            key={form}
            type="button"
            className="desk-control"
            data-tone={form === 'remove' ? 'danger' : undefined}
            onClick={() => setOpen(form)}
            data-cursor="hover"
          >
            {label}
          </button>
        ))}
      </div>
      {/* Keyed by the form, so each opening starts with a clean form and no card left from last time. */}
      <ControlDialog key={open ?? 'none'} view={view} form={open} onClose={() => setOpen(null)} />
    </section>
  )
}

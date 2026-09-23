'use client'

import type { ButtonKind } from '@desk/core'
import { controlsCopy as c, deskCopy } from '@desk/shared'
import { useState, useTransition } from 'react'
import { proposeAction } from '@/app/owner-actions'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { Receive } from '@/features/agent/Receive'
import { BridgeIn } from './BridgeIn'
import { ControlFields, type ControlForm, type FormState } from './ControlForms'
import type { ChatCard } from './chat-model'
import { ProposalCard } from './ProposalCard'
import { encodeRules } from './RulesEditor'

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
  /** What the desk was told, for editing with no model call [8.9, 8.14]. Null before a mandate exists. */
  mandate: {
    presetId: string | null
    targets: { symbol: string; weightBps: number }[]
    cashBps: number
    driftToleranceBps: number
    maxPositionBps: number
    lossStopBps: number
    notes: string
    rules: { symbol: string; fallBps: number; cutBps: number }[]
  } | null
  tokens: { symbol: string; name: string }[]
  presets: { id: string; name: string }[]
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
    case 'editMandate':
      return mandateRequest(f)
  }
}

const pctToBps = (s: string) => String(Math.round(Number(s) * 100))

/** The mandate kinds take the same fields the chat's checks read, as strings. One part at a time. */
function mandateRequest(f: FormState): {
  kind: ButtonKind
  words: string
  fields: Record<string, string | null>
} {
  switch (f.part) {
    case 'strategy':
      return {
        kind: 'switch_strategy',
        words: c.words.switchStrategy(f.presetName),
        fields: { presetId: f.preset },
      }
    case 'weights':
      return {
        kind: 'set_weights',
        words: c.words.setWeights,
        fields: {
          targets: Object.entries(f.weights)
            .filter(([, pct]) => Number(pct) > 0)
            .map(([symbol, pct]) => `${symbol}=${pctToBps(pct)}`)
            .join(','),
          cashBps: pctToBps(f.cashPct),
        },
      }
    case 'limits':
      return {
        kind: 'set_limits',
        words: c.words.setLimits,
        fields: {
          driftToleranceBps: pctToBps(f.driftPct),
          maxPositionBps: pctToBps(f.positionPct),
          lossStopBps: pctToBps(f.lossPct),
        },
      }
    case 'notes':
      return { kind: 'set_notes', words: c.words.setNotes, fields: { notes: f.notes } }
    case 'rules':
      return { kind: 'set_rules', words: c.words.setRules, fields: { rules: encodeRules(f.rules) } }
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
  editMandate: c.editMandate,
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
  const m = view.mandate
  const pct = (bps: number) => String(bps / 100)
  const [state, setState] = useState<FormState>({
    amount: '',
    everything: false,
    asStocks: false,
    mode: view.mode,
    perAction: '',
    daily: '',
    part: 'strategy',
    preset: m?.presetId ?? view.presets[0]?.id ?? '',
    presetName: view.presets.find((p) => p.id === m?.presetId)?.name ?? view.presets[0]?.name ?? '',
    weights: Object.fromEntries((m?.targets ?? []).map((t) => [t.symbol, pct(t.weightBps)])),
    cashPct: pct(m?.cashBps ?? 0),
    driftPct: pct(m?.driftToleranceBps ?? 300),
    positionPct: pct(m?.maxPositionBps ?? 5000),
    lossPct: pct(m?.lossStopBps ?? 1500),
    notes: m?.notes ?? '',
    rules: (m?.rules ?? []).map((r) => ({
      symbol: r.symbol,
      fallPct: pct(r.fallBps),
      cutPct: pct(r.cutBps),
    })),
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
          {/* The third way in: straight to the agent's address from any wallet or exchange. */}
          {form === 'addMoney' && <Receive address={view.address} />}
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
    ...(view.mandate ? [['editMandate', c.actions.editMandate] as [ControlForm, string]] : []),
    view.assistantRemoved ? ['restart', c.actions.restart] : ['remove', c.actions.removeAssistant],
  ]
  return (
    <section className="desk-panel">
      <header className="desk-panel-head">
        <h2 className="type-label-micro text-ink-muted">{c.title}</h2>
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

/**
 * The four things an owner reaches for most, right under the desk's value (after Agari's cockpit toolbar): add
 * money, take it out, pause or resume, and ask for a look now. Each opens the same dialog and card as the full set
 * of controls, which lives under Settings.
 */
export function QuickActions({ view }: { view: ControlsView }) {
  const [open, setOpen] = useState<ControlForm | null>(null)
  if (view.lifecycle === 'closed') return null
  const paused = view.state === 'paused_by_owner'
  const buttons: [ControlForm, string, boolean][] = [
    ['addMoney', c.actions.addMoney, true],
    ['withdraw', c.actions.withdraw, false],
    paused ? ['resume', c.actions.resume, false] : ['pause', c.actions.pause, false],
    ['checkNow', c.actions.checkNow, false],
  ]
  return (
    <div className="desk-quick">
      {buttons.map(([form, label, primary]) => (
        <button
          key={form}
          type="button"
          className="desk-quick-btn"
          data-primary={primary ? '' : undefined}
          onClick={() => setOpen(form)}
          data-cursor="hover"
        >
          {label}
        </button>
      ))}
      <ControlDialog key={open ?? 'none'} view={view} form={open} onClose={() => setOpen(null)} />
    </div>
  )
}

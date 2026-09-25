'use client'

import type { ButtonKind } from '@desk/core'
import { controlsCopy as c, deskCopy } from '@desk/shared'
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  FlaskConical,
  Gauge,
  Hand,
  HandCoins,
  Pause,
  Play,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  UserCheck,
  UserX,
  Zap,
} from 'lucide-react'
import type { Route } from 'next'
import Link from 'next/link'
import { type ReactNode, useState, useTransition } from 'react'
import { proposeAction } from '@/app/owner-actions'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
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
  initialMode,
}: {
  view: ControlsView
  form: ControlForm | null
  onClose: () => void
  /** The mode picked on the mode switch, so its dialog opens on that choice. */
  initialMode?: ControlsView['mode'] | undefined
}) {
  const m = view.mandate
  const pct = (bps: number) => String(bps / 100)
  const [state, setState] = useState<FormState>({
    amount: '',
    everything: false,
    asStocks: false,
    mode: initialMode ?? view.mode,
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
          <button
            type="button"
            className="na-cta"
            onClick={review}
            disabled={pending || (form === 'mode' && state.mode === view.mode)}
          >
            {pending ? c.reviewing : c.review}
          </button>
        </>
      )}
    </Modal>
  )
}

const ICONS: Partial<Record<ControlForm, ReactNode>> = {
  sellAll: <HandCoins aria-hidden="true" />,
  pause: <Pause aria-hidden="true" />,
  resume: <Play aria-hidden="true" />,
  mode: <Gauge aria-hidden="true" />,
  limits: <ShieldCheck aria-hidden="true" />,
  checkNow: <RefreshCw aria-hidden="true" />,
  editMandate: <SlidersHorizontal aria-hidden="true" />,
  remove: <UserX aria-hidden="true" />,
  restart: <UserCheck aria-hidden="true" />,
}

/**
 * Every control, as icon tiles. Each one makes the same card the chat would, and nothing happens until it is
 * confirmed. `bare` drops the panel's own heading where a tab already names it; `withoutMode` leaves the mode to
 * the mode switch above.
 */
export function DeskControls({
  view,
  bare = false,
  withoutMode = false,
}: {
  view: ControlsView
  bare?: boolean
  withoutMode?: boolean
}) {
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
  // Money in and out open their own screens, where any token can go in and every way out is offered.
  const buttons: [ControlForm, string][] = [
    paused ? ['resume', c.actions.resume] : ['pause', c.actions.pause],
    ['checkNow', c.actions.checkNow],
    ...(withoutMode ? [] : [['mode', c.actions.mode] as [ControlForm, string]]),
    ['limits', c.actions.limits],
    ...(view.mandate ? [['editMandate', c.actions.editMandate] as [ControlForm, string]] : []),
    ['sellAll', c.actions.sellAll],
    view.assistantRemoved ? ['restart', c.actions.restart] : ['remove', c.actions.removeAssistant],
  ]
  const tiles = (
    <div className="ctl-grid">
      <Link href={`/fund?agent=${view.slug}` as Route} className="ctl-tile ctl-tile--primary">
        <ArrowDownToLine aria-hidden="true" />
        {c.actions.addMoney}
      </Link>
      <Link href={`/withdraw?agent=${view.slug}` as Route} className="ctl-tile">
        <ArrowUpFromLine aria-hidden="true" />
        {c.actions.withdraw}
      </Link>
      {buttons.map(([form, label]) => (
        <button
          key={form}
          type="button"
          className="ctl-tile"
          data-tone={form === 'remove' || form === 'sellAll' ? 'danger' : undefined}
          onClick={() => setOpen(form)}
          data-cursor="hover"
        >
          {ICONS[form]}
          {label}
        </button>
      ))}
      {/* Keyed by the form, so each opening starts with a clean form and no card left from last time. */}
      <ControlDialog key={open ?? 'none'} view={view} form={open} onClose={() => setOpen(null)} />
    </div>
  )
  if (bare) return tiles
  return (
    <section className="desk-panel">
      <header className="desk-panel-head">
        <h2 className="type-label-micro text-ink-muted">{c.title}</h2>
      </header>
      <p className="type-caption text-ink-muted">{c.intro}</p>
      {tiles}
    </section>
  )
}

/**
 * The mode, as three cards with the current one marked: practice, ask me first, on its own. Picking another opens
 * the same confirm card as the chat's. Any mode at any time (DECISIONS R8).
 */
export function ModeSwitch({ view }: { view: ControlsView }) {
  const [picked, setPicked] = useState<ControlsView['mode'] | null>(null)
  if (view.lifecycle === 'closed') return null
  const modes: [ControlsView['mode'], ReactNode][] = [
    ['shadow', <FlaskConical key="s" aria-hidden="true" />],
    ['ask_first', <Hand key="a" aria-hidden="true" />],
    ['on_its_own', <Zap key="o" aria-hidden="true" />],
  ]
  return (
    <div className="mode-switch" role="radiogroup" aria-label={c.actions.mode}>
      {modes.map(([m, icon]) => {
        const on = view.mode === m
        return (
          // biome-ignore lint/a11y/useSemanticElements: a whole card is the choice; role and state make it a radio.
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={on}
            className={on ? 'mode-card is-on' : 'mode-card'}
            onClick={() => !on && setPicked(m)}
          >
            <span className="mode-card-icon">{icon}</span>
            <b>{deskCopy.modes[m]}</b>
            <small>{deskCopy.modeNote[m]}</small>
            {on && <span className="mode-card-now">{c.current}</span>}
          </button>
        )
      })}
      <ControlDialog
        key={picked ?? 'none'}
        view={view}
        form={picked ? 'mode' : null}
        initialMode={picked ?? undefined}
        onClose={() => setPicked(null)}
      />
    </div>
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
    paused ? ['resume', c.actions.resume, false] : ['pause', c.actions.pause, false],
    ['checkNow', c.actions.checkNow, false],
  ]
  return (
    <div className="desk-quick">
      <Link href={`/fund?agent=${view.slug}` as Route} className="desk-quick-btn" data-primary="">
        {c.actions.addMoney}
      </Link>
      <Link href={`/withdraw?agent=${view.slug}` as Route} className="desk-quick-btn">
        {c.actions.withdraw}
      </Link>
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

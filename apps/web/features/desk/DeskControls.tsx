'use client'

import type { ButtonKind } from '@desk/core'
import { controlsCopy as c, deskCopy, settingsCopy } from '@desk/shared'
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ChevronRight,
  FlaskConical,
  Gauge,
  Hand,
  HandCoins,
  Pause,
  Play,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  TriangleAlert,
  UserCheck,
  UserX,
  Zap,
} from 'lucide-react'
import type { Route } from 'next'
import Link from 'next/link'
import { type ReactNode, useState, useTransition } from 'react'
import { proposeAction } from '@/app/owner-actions'
import { Modal } from '@/components/ui/modal'
import { ControlFields, type ControlForm, type FormState } from './ControlForms'
import type { ChatCard } from './chat-model'
import { ProposalCard } from './ProposalCard'
import { encodeRules } from './RulesEditor'

const t = settingsCopy.trading

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

/** One line under each tile, so a tile says what it does before it is pressed. */
const NOTES: Partial<Record<ControlForm, string>> = {
  pause: t.tiles.pause,
  resume: t.tiles.resume,
  checkNow: t.tiles.checkNow,
  limits: t.tiles.limits,
  editMandate: t.tiles.editMandate,
  sellAll: t.tiles.sellAll,
  remove: t.tiles.remove,
  restart: t.tiles.restart,
}

function Tile({
  icon,
  label,
  note,
  tone,
}: {
  icon: ReactNode
  label: string
  note?: string | undefined
  tone?: 'primary' | 'danger' | undefined
}) {
  return (
    <>
      <span className="ctl-chip" data-tone={tone}>
        {icon}
      </span>
      <span className="ctl-text">
        <b>{label}</b>
        {note && <small>{note}</small>}
      </span>
      <ChevronRight className="ctl-go" aria-hidden="true" />
    </>
  )
}

/**
 * Every control, as icon tiles in four labelled groups (money, running, what it may do, stop), after 21st's Quick
 * Actions Grid (24848): an icon chip, the action and one line, with the ones that sell or cut access in the danger
 * tone. Each one makes the same card the chat would, and nothing happens until it is confirmed. `bare` drops the
 * panel's own heading where a tab already names it; `withoutMode` leaves the mode to the mode switch above.
 */
export function DeskControls({
  view,
  bare = false,
  withoutMode = false,
  withoutPlan = false,
}: {
  view: ControlsView
  bare?: boolean
  withoutMode?: boolean
  /** Leave the limits and the plan to the Plan tab, which has its own buttons for both. */
  withoutPlan?: boolean
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
  const button = ([form, label]: [ControlForm, string]) => (
    <button
      key={form}
      type="button"
      className="ctl-tile"
      data-tone={form === 'remove' || form === 'sellAll' ? 'danger' : undefined}
      onClick={() => setOpen(form)}
      data-cursor="hover"
    >
      <Tile
        icon={ICONS[form]}
        label={label}
        note={NOTES[form]}
        tone={form === 'remove' || form === 'sellAll' ? 'danger' : undefined}
      />
    </button>
  )
  // Money in and out open their own screens, where any token can go in and every way out is offered.
  const groups: [string, ReactNode, boolean?][] = [
    [
      t.groups.money,
      <>
        <Link href={`/fund?agent=${view.slug}` as Route} className="ctl-tile ctl-tile--primary">
          <Tile
            icon={<ArrowDownToLine aria-hidden="true" />}
            label={c.actions.addMoney}
            note={t.tiles.addMoney}
            tone="primary"
          />
        </Link>
        <Link href={`/withdraw?agent=${view.slug}` as Route} className="ctl-tile">
          <Tile
            icon={<ArrowUpFromLine aria-hidden="true" />}
            label={c.actions.withdraw}
            note={t.tiles.withdraw}
          />
        </Link>
      </>,
    ],
    [
      t.groups.running,
      <>
        {button(paused ? ['resume', c.actions.resume] : ['pause', c.actions.pause])}
        {button(['checkNow', c.actions.checkNow])}
        {!withoutMode && button(['mode', c.actions.mode])}
      </>,
    ],
    ...(withoutPlan
      ? []
      : [
          [
            t.groups.rules,
            <>
              {button(['limits', c.actions.limits])}
              {view.mandate && button(['editMandate', c.actions.editMandate])}
            </>,
          ] as [string, ReactNode],
        ]),
    [
      t.groups.stop,
      <>
        {button(['sellAll', c.actions.sellAll])}
        {button(
          view.assistantRemoved ? ['restart', c.actions.restart] : ['remove', c.actions.removeAssistant],
        )}
      </>,
      true,
    ],
  ]
  const tiles = (
    <div className="ctl-groups">
      {groups.map(([title, items, danger]) => (
        <section
          key={title}
          className={danger ? 'ctl-group ctl-group--danger' : 'ctl-group'}
          aria-label={title}
        >
          <h4 className="ctl-group-title">
            {danger && <TriangleAlert aria-hidden="true" />}
            {title}
          </h4>
          <div className="ctl-grid">{items}</div>
        </section>
      ))}
      <p className="ctl-hint">{t.confirmFirst}</p>
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

const money = (raw: string | null) =>
  raw === null
    ? t.unset
    : `$${(Number(raw) / 1e6).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/**
 * Where the agent stands, above its controls, in the Stats Grid cells the Plan tab uses (21st 29195): running or
 * paused, the cash it holds, and the two caps its contract enforces.
 */
export function TradingStatus({ view }: { view: ControlsView }) {
  const paused = view.state === 'paused_by_owner'
  const state = view.assistantRemoved ? 'removed' : paused ? 'paused' : 'running'
  const cells: [string, ReactNode, string | null][] = [
    [
      t.status,
      <span key="s" className="ts-state" data-state={state}>
        <i aria-hidden="true" />
        {t[state]}
      </span>,
      deskCopy.modes[view.mode],
    ],
    [t.cash, money(view.cashUsdg), null],
    [t.perTrade, money(view.perActionCapUsdg), t.onChain],
    [t.perDay, money(view.dailyCapUsdg), t.onChain],
  ]
  return (
    <div className="pl-limits ts-grid">
      {cells.map(([label, value, note]) => (
        <div key={label}>
          <span className="pl-limit-value">{value}</span>
          <span className="pl-limit-label">{label}</span>
          {note && <small>{note}</small>}
        </div>
      ))}
    </div>
  )
}

/**
 * The mode, as three cards with the current one marked: practice, ask me first, on its own. After 21st's Feature
 * Toggle Switch Cards (22208): an icon chip and a radio ring on each card, the chosen one tinted. Picking another
 * opens the same confirm card as the chat's. Any mode at any time (DECISIONS R8).
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
            <span className="mode-card-top">
              <span className="mode-card-icon">{icon}</span>
              <span className="mode-card-radio" aria-hidden="true" />
            </span>
            <b>
              {deskCopy.modes[m]}
              {on && <span className="mode-card-now">{c.current}</span>}
            </b>
            <small>{deskCopy.modeNote[m]}</small>
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

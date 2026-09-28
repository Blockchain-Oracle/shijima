'use client'

import { controlsCopy as c, deskCopy, usd } from '@desk/shared'
import { TokenLogo } from '@/components/ui/token-logo'
import { cn } from '@/lib/utils'
import type { ControlsView } from './DeskControls'
import { type DraftRule, RulesEditor } from './RulesEditor'

export type ControlForm =
  | 'addMoney'
  | 'withdraw'
  | 'sellAll'
  | 'pause'
  | 'resume'
  | 'mode'
  | 'limits'
  | 'checkNow'
  | 'remove'
  | 'restart'
  | 'closeDesk'
  | 'editMandate'

export type MandatePart = 'strategy' | 'weights' | 'limits' | 'notes' | 'rules'

export interface FormState {
  amount: string
  everything: boolean
  asStocks: boolean
  mode: 'shadow' | 'ask_first' | 'on_its_own'
  perAction: string
  daily: string
  /** Editing the mandate, one part at a time. Percentages as typed; the request turns them into basis points. */
  part: MandatePart
  preset: string
  presetName: string
  weights: Record<string, string>
  cashPct: string
  driftPct: string
  positionPct: string
  lossPct: string
  notes: string
  rules: DraftRule[]
}

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`

function Amount({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="desk-field">
      <span className="type-label-micro text-ink-muted">{label}</span>
      <span className="desk-input">
        <span aria-hidden>$</span>
        <input
          inputMode="decimal"
          placeholder="0.00"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ''))}
        />
      </span>
    </label>
  )
}

function Choice<T extends string | boolean>({
  options,
  value,
  onChange,
  disabled,
}: {
  options: [T, string][]
  value: T
  onChange: (v: T) => void
  disabled?: (v: T) => boolean
}) {
  return (
    <div className="desk-choice">
      {options.map(([v, label]) => (
        <button
          key={String(v)}
          type="button"
          aria-pressed={value === v}
          disabled={disabled?.(v)}
          className={cn('desk-choice-option', value === v && 'active')}
          onClick={() => onChange(v)}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

/** The few inputs each control needs. Forms with nothing to choose show only their heading and the button. */
export function ControlFields({
  form,
  view,
  state,
  onChange,
}: {
  form: ControlForm
  view: ControlsView
  state: FormState
  onChange: (next: FormState) => void
}) {
  const set = (patch: Partial<FormState>) => onChange({ ...state, ...patch })
  switch (form) {
    case 'addMoney':
      return (
        <>
          <strong className="type-body-strong text-ink">{c.addMoney.here}</strong>
          <span className="type-caption text-ink-muted">{c.addMoney.hereNote}</span>
          <Amount label={c.addMoney.amount} value={state.amount} onChange={(amount) => set({ amount })} />
          <p className="type-caption text-ink-muted">{c.addMoney.minimum}</p>
        </>
      )
    case 'withdraw':
      return (
        <>
          <div className="desk-rows">
            <div className="desk-row">
              <span>{c.withdraw.to}</span>
              <span className="type-data">{short(view.owner)}</span>
            </div>
          </div>
          <Choice
            options={[
              [false, c.withdraw.some],
              [true, c.withdraw.all],
            ]}
            value={state.everything}
            onChange={(everything) => set({ everything })}
          />
          {state.everything ? (
            <Choice
              options={[
                [false, c.withdraw.asCash],
                [true, c.withdraw.asStocks],
              ]}
              value={state.asStocks}
              onChange={(asStocks) => set({ asStocks })}
            />
          ) : (
            <>
              <Amount label={c.withdraw.amount} value={state.amount} onChange={(amount) => set({ amount })} />
              {view.cashUsdg && (
                <p className="type-caption text-ink-muted">
                  {c.withdraw.cashNow(usd(BigInt(view.cashUsdg)))}
                </p>
              )}
            </>
          )}
        </>
      )
    case 'mode':
      return (
        <>
          <Choice
            options={(['shadow', 'ask_first', 'on_its_own'] as const).map((m) => [m, deskCopy.modes[m]])}
            value={state.mode}
            onChange={(mode) => set({ mode })}
          />
          <p className="type-caption text-ink-secondary">{deskCopy.modeNote[state.mode]}</p>
          {state.mode === 'on_its_own' && <p className="type-caption text-warning">{c.mode.onItsOwn}</p>}
        </>
      )
    case 'limits':
      return (
        <>
          <Amount
            label={c.limits.perAction}
            value={state.perAction}
            onChange={(perAction) => set({ perAction })}
          />
          <Amount label={c.limits.daily} value={state.daily} onChange={(daily) => set({ daily })} />
          {view.perActionCapUsdg && view.dailyCapUsdg && (
            <p className="type-caption text-ink-muted">
              {c.limits.settings(usd(BigInt(view.perActionCapUsdg)), usd(BigInt(view.dailyCapUsdg)))}
            </p>
          )}
        </>
      )
    case 'closeDesk':
      return (
        <Choice
          options={[
            [false, c.closeDesk.asCash],
            [true, c.closeDesk.asStocks],
          ]}
          value={state.asStocks}
          onChange={(asStocks) => set({ asStocks })}
        />
      )
    case 'editMandate':
      return <MandateFields view={view} state={state} set={set} />
    default:
      return null
  }
}

const PARTS: MandatePart[] = ['strategy', 'weights', 'limits', 'notes', 'rules']

function Pct({
  label,
  value,
  onChange,
  symbol,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  /** A token, or USDG for cash: its real logo sits beside the label. */
  symbol?: string
}) {
  return (
    <label className="desk-field">
      <span className="flex items-center gap-2 type-label-micro text-ink-muted">
        {symbol && <TokenLogo symbol={symbol} size={18} />}
        {label}
      </span>
      <span className="desk-input">
        <input
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ''))}
        />
        <span aria-hidden>%</span>
      </span>
    </label>
  )
}

/** Edit what the desk was told, one part at a time, with no model call. The card shows before and after. */
function MandateFields({
  view,
  state,
  set,
}: {
  view: ControlsView
  state: FormState
  set: (patch: Partial<FormState>) => void
}) {
  const e = c.editMandate
  const total =
    Number(state.cashPct || 0) + Object.values(state.weights).reduce((a, b) => a + Number(b || 0), 0)
  return (
    <>
      <Choice
        options={PARTS.map((p) => [p, e.parts[p]])}
        value={state.part}
        onChange={(part) => set({ part })}
      />
      {state.part === 'strategy' && (
        <>
          <p className="type-caption text-ink-secondary">{e.strategy}</p>
          <Choice
            options={view.presets.map((p) => [p.id, p.name])}
            value={state.preset}
            onChange={(preset) =>
              set({ preset, presetName: view.presets.find((p) => p.id === preset)?.name ?? '' })
            }
          />
        </>
      )}
      {state.part === 'weights' && (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            {view.tokens.map((t) => (
              <Pct
                key={t.symbol}
                label={t.name}
                symbol={t.symbol}
                value={state.weights[t.symbol] ?? ''}
                onChange={(v) => set({ weights: { ...state.weights, [t.symbol]: v } })}
              />
            ))}
            <Pct
              label={e.cash}
              symbol="USDG"
              value={state.cashPct}
              onChange={(cashPct) => set({ cashPct })}
            />
          </div>
          <p className={cn('type-caption', Math.abs(total - 100) < 0.01 ? 'text-ink-muted' : 'text-warning')}>
            {e.total(`${total.toFixed(total % 1 === 0 ? 0 : 1)}%`)}
          </p>
        </>
      )}
      {state.part === 'limits' && (
        <div className="grid gap-3 sm:grid-cols-3">
          <Pct label={e.drift} value={state.driftPct} onChange={(driftPct) => set({ driftPct })} />
          <Pct
            label={e.position}
            value={state.positionPct}
            onChange={(positionPct) => set({ positionPct })}
          />
          <Pct label={e.loss} value={state.lossPct} onChange={(lossPct) => set({ lossPct })} />
        </div>
      )}
      {state.part === 'notes' && (
        <label className="desk-field">
          <span className="type-label-micro text-ink-muted">{e.notes}</span>
          <textarea
            className="desk-textarea"
            rows={4}
            maxLength={2000}
            value={state.notes}
            onChange={(ev) => set({ notes: ev.target.value })}
          />
          <span className="type-caption text-ink-muted">{e.notesHint}</span>
        </label>
      )}
      {state.part === 'rules' && (
        <RulesEditor
          rules={state.rules}
          tokens={view.tokens.filter((t) => (view.mandate?.targets ?? []).some((x) => x.symbol === t.symbol))}
          onChange={(rules) => set({ rules })}
        />
      )}
    </>
  )
}

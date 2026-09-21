'use client'

import { controlsCopy as c, deskCopy, usd } from '@desk/shared'
import { cn } from '@/lib/utils'
import type { ControlsView } from './DeskControls'

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

export interface FormState {
  amount: string
  everything: boolean
  asStocks: boolean
  mode: 'shadow' | 'ask_first' | 'on_its_own'
  perAction: string
  daily: string
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
    case 'mode': {
      const live = view.shadowChecks >= view.goLiveChecks && view.reportOpened
      return (
        <>
          <Choice
            options={(['shadow', 'ask_first', 'on_its_own'] as const).map((m) => [m, deskCopy.modes[m]])}
            value={state.mode}
            onChange={(mode) => set({ mode })}
            disabled={(m) => m !== 'shadow' && view.mode === 'shadow' && !live}
          />
          <p className="type-caption text-ink-secondary">{deskCopy.modeNote[state.mode]}</p>
          {view.mode === 'shadow' && !live && (
            <p className="type-caption text-ink-muted">
              {c.mode.locked(view.shadowChecks, view.goLiveChecks, view.reportOpened)}
            </p>
          )}
          {state.mode === 'on_its_own' && <p className="type-caption text-warning">{c.mode.onItsOwn}</p>}
        </>
      )
    }
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
    default:
      return null
  }
}

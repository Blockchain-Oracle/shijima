'use client'

import { type Preset, percent, studioCopy } from '@desk/shared'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { type DraftToken, draftTotalBps, NOTES_MAX, type StudioDraft, withPreset } from './draft'

const I = studioCopy.identity
const B = studioCopy.behaviour

type SetDraft = (update: (d: StudioDraft) => StudioDraft) => void

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: the input is passed in as children
    <label className="block">
      <span className="desk-field-label">{label}</span>
      {children}
      {hint && <span className="studio-hint block">{hint}</span>}
    </label>
  )
}

/** A whole-number percentage box that edits basis points. */
function PctInput({ bps, onChange, label }: { bps: number; onChange: (bps: number) => void; label: string }) {
  return (
    <span className="studio-pct block">
      <input
        className="strat-input text-ink"
        inputMode="decimal"
        aria-label={label}
        value={bps === 0 ? '' : String(bps / 100)}
        placeholder="0"
        onChange={(e) => {
          const n = Number(e.target.value.replace(',', '.'))
          if (Number.isFinite(n)) onChange(Math.max(0, Math.min(10_000, Math.round(n * 100))))
        }}
      />
    </span>
  )
}

/**
 * Step 1: a name and a basket. A mix fills every share and each stays editable, so nobody faces an empty form
 * (design brief 8.6). The total is shown as it is typed, because a basket that does not add up to 100% is
 * refused, and that should never be a surprise.
 */
export function BasketStep({
  draft,
  setDraft,
  presets,
  tokens,
}: {
  draft: StudioDraft
  setDraft: SetDraft
  presets: Preset[]
  tokens: DraftToken[]
}) {
  const total = draftTotalBps(draft)
  return (
    <div className="space-y-6">
      <Field label={I.name} hint={I.nameHint}>
        <input
          className="strat-input text-ink"
          value={draft.name}
          maxLength={40}
          placeholder={I.namePlaceholder}
          onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
        />
      </Field>

      <div>
        <div className="desk-field-label">{I.mix}</div>
        <div className="grid gap-3 sm:grid-cols-2">
          {presets.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={draft.preset === p.id}
              onClick={() => setDraft((d) => withPreset(d, p))}
              className={cn('strat-choice', draft.preset === p.id && 'strat-choice--on')}
              data-cursor="hover"
            >
              <span className="strat-choice-title text-ink">{p.name}</span>
              <p className="strat-choice-body">{p.description}</p>
            </button>
          ))}
          <button
            type="button"
            aria-pressed={draft.preset === null}
            onClick={() => setDraft((d) => ({ ...d, preset: null }))}
            className={cn('strat-choice', draft.preset === null && 'strat-choice--on')}
            data-cursor="hover"
          >
            <span className="strat-choice-title text-ink">{I.own}</span>
            <p className="strat-choice-body">{I.ownBody}</p>
          </button>
        </div>
      </div>

      <div>
        <div className="desk-field-label">{I.basket}</div>
        <div className="studio-basket">
          {tokens.map((t) => (
            <div key={t.symbol} className="studio-basket-row">
              <span className="studio-basket-name">
                {t.name} <span className="text-ink-muted">{t.symbol}</span>
                <small>{t.tradability}</small>
              </span>
              <PctInput
                label={t.name}
                bps={draft.weights[t.symbol] ?? 0}
                onChange={(bps) =>
                  setDraft((d) => {
                    const weights = { ...d.weights, [t.symbol]: bps }
                    if (bps === 0) delete weights[t.symbol]
                    return { ...d, weights, preset: null }
                  })
                }
              />
            </div>
          ))}
          <div className="studio-basket-row">
            <span className="studio-basket-name">
              {I.cash}
              <small>{I.cashNote}</small>
            </span>
            <PctInput
              label={I.cash}
              bps={draft.cashBps}
              onChange={(bps) => setDraft((d) => ({ ...d, cashBps: bps, preset: null }))}
            />
          </div>
        </div>
        <div className="studio-basket-total" data-bad={total !== 10_000}>
          <span>{total === 10_000 ? '' : I.mustAddUp}</span>
          <span>{I.total(percent(total))}</span>
        </div>
      </div>
    </div>
  )
}

/**
 * Step 2: how strict, the limits, and the owner's notes. The two limits the contract itself holds are set apart,
 * because changing those later needs the wallet; the rest save instantly (design brief 8.6).
 */
export function LimitsStep({ draft, setDraft }: { draft: StudioDraft; setDraft: SetDraft }) {
  const pct = (key: 'driftPct' | 'maxPositionPct' | 'lossStopPct', label: string, hint?: string) => (
    <Field label={label} {...(hint ? { hint } : {})}>
      <span className="studio-pct block">
        <input
          className="strat-input text-ink"
          inputMode="decimal"
          value={draft[key]}
          onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
        />
      </span>
    </Field>
  )
  const usd = (key: 'perAction' | 'daily' | 'large', label: string, hint?: string) => (
    <Field label={label} {...(hint ? { hint } : {})}>
      <span className="studio-dollar block">
        <input
          className="strat-input text-ink"
          inputMode="decimal"
          value={draft[key]}
          onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
        />
      </span>
    </Field>
  )
  return (
    <div className="space-y-6">
      <div>
        <h3 className="strat-choice-title mb-4 text-ink">{B.title}</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          {pct('driftPct', B.drift, B.driftHint)}
          {pct('maxPositionPct', B.position)}
          {pct('lossStopPct', B.loss, B.lossHint)}
          {usd('large', B.large, B.largeHint)}
        </div>
      </div>

      <div className="studio-chain-box">
        <h3 className="strat-choice-title text-ink">{B.limitsTitle}</h3>
        <p className="strat-choice-body mb-4">{B.limitsBody}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          {usd('perAction', B.perAction)}
          {usd('daily', B.daily)}
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-baseline justify-between">
          <span className="desk-field-label mb-0">{B.notes}</span>
          <span
            className={cn(
              'strat-mono-10 tabular-nums',
              draft.notes.length >= NOTES_MAX ? 'text-vermilion' : 'text-ink-muted',
            )}
          >
            {B.count(draft.notes.length, NOTES_MAX)}
          </span>
        </div>
        <textarea
          className="strat-input strat-textarea text-ink"
          rows={4}
          maxLength={NOTES_MAX}
          value={draft.notes}
          placeholder={B.notesPlaceholder}
          aria-label={B.notes}
          onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value.slice(0, NOTES_MAX) }))}
        />
        <p className="studio-hint">{B.notesHint}</p>
      </div>
    </div>
  )
}

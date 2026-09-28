'use client'

import { lookOf, money, percent, studioCopy } from '@desk/shared'
import { Sparkles, UserPen } from 'lucide-react'
import type { ReactNode } from 'react'
import { AllocationDonut } from '@/components/ui/allocation-donut'
import { TokenLogo } from '@/components/ui/token-logo'
import { RulesEditor } from '@/features/desk/RulesEditor'
import { cn } from '@/lib/utils'
import { type DraftToken, draftTotalBps, NOTES_MAX, type StudioDraft } from './draft'
import { mixSlices } from './StrategyCard'

const I = studioCopy.identity
const B = studioCopy.behaviour
const F = studioCopy.flow

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

/** Cash is whatever the stocks leave, so a basket built by hand always adds up. */
const withCashRest = (weights: Record<string, number>) => {
  const held = Object.values(weights).reduce((a, b) => a + b, 0)
  return { weights, cashBps: Math.max(0, 10_000 - held) }
}

/**
 * "Build your own" (StrategyStep): logo tiles to tap and a slider each, and cash is always the remainder, so the
 * total cannot fail to reach 100%.
 */
export function BasketStep({
  draft,
  setDraft,
  tokens,
}: {
  draft: StudioDraft
  setDraft: SetDraft
  tokens: DraftToken[]
}) {
  const total = draftTotalBps(draft)
  const own = draft.preset === null
  const slices = mixSlices(draft.weights, draft.cashBps, tokens)
  const picked = tokens.filter((t) => draft.weights[t.symbol] !== undefined)
  const setWeight = (symbol: string, bps: number | undefined) =>
    setDraft((d) => {
      const weights = { ...d.weights }
      if (bps === undefined) delete weights[symbol]
      else weights[symbol] = Math.max(0, Math.min(10_000, bps))
      return { ...d, ...withCashRest(weights), preset: null }
    })
  const evenSplit = () =>
    setDraft((d) => {
      const keys = Object.keys(d.weights)
      if (keys.length === 0) return d
      // Four fifths in stocks, a fifth kept as cash to buy with, split evenly and rounded to whole percents.
      const each = Math.floor(8000 / keys.length / 100) * 100
      const weights = Object.fromEntries(keys.map((k) => [k, each]))
      return { ...d, ...withCashRest(weights), preset: null }
    })

  return (
    <div className="space-y-7">
      {own && (
        <div>
          <div className="desk-field-label">{I.pick}</div>
          <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
            {tokens.map((t) => {
              const on = draft.weights[t.symbol] !== undefined
              return (
                <button
                  key={t.symbol}
                  type="button"
                  aria-pressed={on}
                  title={t.name}
                  onClick={() => setWeight(t.symbol, on ? undefined : 1000)}
                  className={cn(
                    'flex flex-col items-center gap-1 rounded-[var(--radius-md)] border p-2 transition-colors',
                    on
                      ? 'border-[var(--color-accent)] bg-[var(--color-accent-wash)]'
                      : 'border-border hover:border-[var(--color-border-strong)]',
                  )}
                >
                  <TokenLogo symbol={t.symbol} size={28} />
                  <span className="text-[10px] text-muted-foreground">{t.symbol}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div className="rounded-[var(--radius-lg)] border border-border bg-[var(--color-surface-2)] p-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="desk-field-label mb-0">{I.basket}</div>
          {own && picked.length > 1 && (
            <button
              type="button"
              onClick={evenSplit}
              className="text-[12px] text-[var(--color-accent)] hover:underline"
            >
              {I.even}
            </button>
          )}
          {!own && (
            <button
              type="button"
              onClick={() => setDraft((d) => ({ ...d, preset: null }))}
              className="text-[12px] text-[var(--color-accent)] hover:underline"
            >
              {I.adjust}
            </button>
          )}
        </div>
        {slices.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">{I.pickFirst}</p>
        ) : (
          <div className="flex flex-wrap items-start gap-6">
            <AllocationDonut slices={slices} size={112} center={percent(total)} caption={I.ofHundred} />
            <div className="flex min-w-[220px] flex-1 flex-col gap-3">
              {own
                ? picked.map((t) => {
                    const bps = draft.weights[t.symbol] ?? 0
                    return (
                      <div key={t.symbol} className="flex items-center gap-2.5">
                        <TokenLogo symbol={t.symbol} size={20} />
                        <span className="w-20 truncate text-[12.5px] text-foreground">{t.name}</span>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          step={1}
                          value={bps / 100}
                          aria-label={t.name}
                          onChange={(e) => setWeight(t.symbol, Number(e.target.value) * 100)}
                          className="h-1.5 min-w-0 flex-1 cursor-pointer"
                          style={{ accentColor: lookOf(t.symbol).color }}
                        />
                        <span className="w-20 shrink-0">
                          <PctInput label={t.name} bps={bps} onChange={(b) => setWeight(t.symbol, b)} />
                        </span>
                      </div>
                    )
                  })
                : slices
                    .filter((sl) => sl.symbol !== 'CASH')
                    .map((sl) => (
                      <div key={sl.symbol} className="flex items-center gap-2.5 text-[12.5px]">
                        <TokenLogo symbol={sl.symbol} size={20} />
                        <span className="flex-1 truncate text-foreground">{sl.label}</span>
                        <span className="font-[family-name:var(--font-data)] text-muted-foreground tabular-nums">
                          {Math.round(sl.pct)}%
                        </span>
                      </div>
                    ))}
              <div className="flex items-center gap-2.5 border-t border-border pt-3 text-[12.5px]">
                <TokenLogo symbol="CASH" size={20} />
                <span className="flex-1 text-foreground">{I.cash}</span>
                <span className="font-[family-name:var(--font-data)] text-muted-foreground tabular-nums">
                  {percent(draft.cashBps)}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">{own ? I.cashRest : I.cashNote}</p>
            </div>
          </div>
        )}
        {total !== 10_000 && slices.length > 0 && (
          <p className="mt-3 text-[12px] text-[var(--color-warning)]" role="alert">
            {I.mustAddUp} {I.total(percent(total))}
          </p>
        )}
      </div>
    </div>
  )
}

/**
 * Step 3: the two limits the account itself holds, up front; how strict, the notes and the protective rules wait
 * under "More options", because most people keep the defaults.
 */
export function LimitsStep({
  draft,
  setDraft,
  tokens,
}: {
  draft: StudioDraft
  setDraft: SetDraft
  tokens: DraftToken[]
}) {
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
  const usd = (key: 'perAction' | 'daily' | 'large', label: string, hint?: string, slideTo?: number) => (
    <Field label={label} {...(hint ? { hint } : {})}>
      <span className="studio-dollar block">
        <input
          className="strat-input text-ink"
          inputMode="decimal"
          value={draft[key]}
          onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value, limitsSet: true }))}
        />
      </span>
      {slideTo !== undefined && (
        // A dollar slider beside the box, for a quick setting; the box stays for an exact amount.
        <input
          type="range"
          min={1}
          max={slideTo}
          step={1}
          aria-label={label}
          value={Math.min(slideTo, Math.max(1, Number(draft[key]) || 1))}
          onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value, limitsSet: true }))}
          className="mt-2 w-full cursor-pointer"
          style={{ accentColor: 'var(--color-accent)' }}
        />
      )}
    </Field>
  )
  return (
    <div className="na-stack">
      <div className="na-limits">
        <p className="na-limits-body">{F.limitsBody}</p>
        {Number(draft.amount) > 0 && (
          // One line saying where the numbers came from: limitsFor sized them to the amount until the owner types.
          <p className="na-limits-sized" data-own={draft.limitsSet ? 'true' : undefined}>
            {draft.limitsSet ? (
              <UserPen aria-hidden="true" className="size-3.5" />
            ) : (
              <Sparkles aria-hidden="true" className="size-3.5" />
            )}
            {draft.limitsSet ? F.limitsOwn : F.limitsSized(money(draft.amount ?? '0'))}
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          {usd('perAction', F.perTrade, undefined, 250)}
          {usd('daily', F.perDay, undefined, 1000)}
        </div>
      </div>

      <details className="na-more">
        <summary>{F.more}</summary>
        <div className="na-more-body">
          <div className="grid gap-4 sm:grid-cols-2">
            {pct('driftPct', B.drift, B.driftHint)}
            {pct('maxPositionPct', B.position)}
            {pct('lossStopPct', B.loss, B.lossHint)}
            {usd('large', B.large, B.largeHint)}
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
              rows={3}
              maxLength={NOTES_MAX}
              value={draft.notes}
              placeholder={B.notesPlaceholder}
              aria-label={B.notes}
              onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value.slice(0, NOTES_MAX) }))}
            />
          </div>
          <div>
            <span className="desk-field-label">{B.rulesTitle}</span>
            <RulesEditor
              rules={draft.rules ?? []}
              tokens={tokens
                .filter((t) => (draft.weights[t.symbol] ?? 0) > 0)
                .map((t) => ({ symbol: t.symbol, name: t.name }))}
              onChange={(rules) => setDraft((d) => ({ ...d, rules }))}
            />
          </div>
        </div>
      </details>
    </div>
  )
}

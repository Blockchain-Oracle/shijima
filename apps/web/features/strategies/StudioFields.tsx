'use client'

import { lookOf, type Preset, percent, studioCopy } from '@desk/shared'
import { Plus } from 'lucide-react'
import type { ReactNode } from 'react'
import { AllocationDonut } from '@/components/ui/allocation-donut'
import { TokenLogo, TokenStack } from '@/components/ui/token-logo'
import { RulesEditor } from '@/features/desk/RulesEditor'
import { cn } from '@/lib/utils'
import { type DraftToken, draftTotalBps, NOTES_MAX, type StudioDraft, withPreset } from './draft'
import { mixSlices, type Performance } from './StrategyCard'

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

/** Cash is whatever the stocks leave, so a basket built by hand always adds up. */
const withCashRest = (weights: Record<string, number>) => {
  const held = Object.values(weights).reduce((a, b) => a + b, 0)
  return { weights, cashBps: Math.max(0, 10_000 - held) }
}

function Change({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-[11px] text-muted-foreground">—</span>
  return (
    <span
      className={cn(
        'font-[family-name:var(--font-data)] text-[13px] font-semibold tabular-nums',
        pct >= 0 ? 'text-[var(--profit)]' : 'text-[var(--loss)]',
      )}
    >
      {pct >= 0 ? '+' : '−'}
      {Math.abs(pct).toFixed(1)}%
    </span>
  )
}

/**
 * Step 1: a name and a basket. The ready-made baskets are radio cards, after 21st's Radio Group with Plan Cards
 * (10156): logos, who it suits, and what it did over the last month. "Build your own" turns into logo tiles to
 * tap and a slider each, and cash is always the remainder, so the total cannot fail to reach 100%.
 */
export function BasketStep({
  draft,
  setDraft,
  presets,
  tokens,
  performance,
}: {
  draft: StudioDraft
  setDraft: SetDraft
  presets: Preset[]
  tokens: DraftToken[]
  performance: Record<string, Performance>
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
      <Field label={I.name} hint={I.nameHint}>
        <input
          className="strat-input text-ink"
          value={draft.name}
          maxLength={40}
          placeholder={I.namePlaceholder}
          onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
        />
      </Field>

      <div role="radiogroup" aria-label={I.mix}>
        <div className="desk-field-label">{I.mix}</div>
        <div className="flex flex-col gap-2">
          {presets.map((p) => {
            const on = draft.preset === p.id
            const held = Object.entries(p.weights)
              .sort((a, b) => b[1] - a[1])
              .map(([s]) => s)
            return (
              // biome-ignore lint/a11y/useSemanticElements: a whole card is the choice; role and state make it a radio.
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setDraft((d) => withPreset(d, p))}
                data-cursor="hover"
                className={cn(
                  'flex items-center gap-3 rounded-[var(--radius-lg)] border p-3 text-left transition-colors',
                  on
                    ? 'border-[var(--color-accent)] bg-[var(--color-accent-wash)]'
                    : 'border-border hover:border-[var(--color-border-strong)]',
                )}
              >
                <TokenStack symbols={held} size={26} max={3} className="min-w-[92px] shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-2">
                    <span className="truncate text-[14px] font-semibold text-foreground">{p.name}</span>
                    <span className="sm:hidden">
                      <Change pct={performance[p.id]?.changePct ?? null} />
                    </span>
                  </span>
                  <span className="block truncate text-[12px] text-muted-foreground">{p.description}</span>
                </span>
                <span className="hidden flex-col items-end sm:flex">
                  <Change pct={performance[p.id]?.changePct ?? null} />
                  <span className="text-[10.5px] text-muted-foreground">{I.monthShort}</span>
                </span>
                <span
                  className={cn(
                    'flex size-4 shrink-0 items-center justify-center rounded-full border-2',
                    on ? 'border-[var(--color-accent)]' : 'border-[var(--color-border-strong)]',
                  )}
                  aria-hidden
                >
                  {on && <span className="size-2 rounded-full bg-[var(--color-accent)]" />}
                </span>
              </button>
            )
          })}
          {/* biome-ignore lint/a11y/useSemanticElements: the same radio card as the baskets above. */}
          <button
            type="button"
            role="radio"
            aria-checked={own}
            onClick={() => setDraft((d) => ({ ...d, preset: null }))}
            data-cursor="hover"
            className={cn(
              'flex items-center gap-3 rounded-[var(--radius-lg)] border border-dashed p-3 text-left transition-colors',
              own
                ? 'border-[var(--color-accent)] bg-[var(--color-accent-wash)]'
                : 'border-border hover:border-[var(--color-border-strong)]',
            )}
          >
            <span className="flex min-w-[92px] shrink-0 items-center">
              <span className="flex size-[26px] items-center justify-center rounded-full border border-dashed border-[var(--color-border-strong)] text-muted-foreground">
                <Plus className="size-3.5" aria-hidden />
              </span>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-semibold text-foreground">{I.own}</span>
              <span className="block text-[12px] text-muted-foreground">{I.ownBody}</span>
            </span>
            <span
              className={cn(
                'flex size-4 shrink-0 items-center justify-center rounded-full border-2',
                own ? 'border-[var(--color-accent)]' : 'border-[var(--color-border-strong)]',
              )}
              aria-hidden
            >
              {own && <span className="size-2 rounded-full bg-[var(--color-accent)]" />}
            </span>
          </button>
        </div>
      </div>

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
 * Step 2: how strict, the limits, and the owner's notes. The two limits the contract itself holds are set apart,
 * because changing those later needs the wallet; the rest save instantly (design brief 8.6).
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
      <div>
        <h3 className="strat-choice-title mb-2 text-ink">{B.rulesTitle}</h3>
        <RulesEditor
          rules={draft.rules ?? []}
          tokens={tokens
            .filter((t) => (draft.weights[t.symbol] ?? 0) > 0)
            .map((t) => ({ symbol: t.symbol, name: t.name }))}
          onChange={(rules) => setDraft((d) => ({ ...d, rules }))}
        />
      </div>
    </div>
  )
}

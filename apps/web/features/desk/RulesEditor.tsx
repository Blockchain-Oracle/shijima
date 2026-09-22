'use client'

import { deskCopy } from '@desk/shared'
import { cn } from '@/lib/utils'

/** A rule as the owner types it: a stock, a fall in percent, and how much to sell then. */
export interface DraftRule {
  symbol: string
  fallPct: string
  cutPct: string
  /** A stable key for the row while it is edited. Not part of the rule. */
  key?: string
}

export const MAX_DRAFT_RULES = 10

/**
 * The protective rules from the design brief's own example, "If Nvidia falls more than 3% over a weekend, cut it
 * by half", as a short table the owner fills in. The desk carries them out by arithmetic, never by reading prose.
 */
export function RulesEditor({
  rules,
  tokens,
  onChange,
  className,
}: {
  rules: DraftRule[]
  tokens: { symbol: string; name: string }[]
  onChange: (rules: DraftRule[]) => void
  className?: string
}) {
  const r = deskCopy.rules
  const nameOf = (symbol: string) => tokens.find((t) => t.symbol === symbol)?.name ?? symbol
  const update = (i: number, patch: Partial<DraftRule>) =>
    onChange(rules.map((rule, j) => (j === i ? { ...rule, ...patch } : rule)))
  const first = tokens[0]?.symbol ?? ''
  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <p className="type-caption text-ink-secondary">{r.hint}</p>
      {rules.length === 0 && <p className="type-caption text-ink-muted">{r.none}</p>}
      {rules.map((rule, i) => (
        <div key={rule.key ?? `${rule.symbol}:${rule.fallPct}:${rule.cutPct}`} className="desk-rule">
          <div className="desk-rule-fields">
            <label className="desk-field">
              <span className="type-label-micro text-ink-muted">{r.stock}</span>
              <span className="desk-input">
                <select value={rule.symbol} onChange={(e) => update(i, { symbol: e.target.value })}>
                  {tokens.map((t) => (
                    <option key={t.symbol} value={t.symbol}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </span>
            </label>
            <label className="desk-field">
              <span className="type-label-micro text-ink-muted">{r.fall}</span>
              <span className="desk-input">
                <input
                  inputMode="decimal"
                  value={rule.fallPct}
                  onChange={(e) => update(i, { fallPct: e.target.value.replace(/[^0-9.]/g, '') })}
                />
                <span aria-hidden>%</span>
              </span>
            </label>
            <label className="desk-field">
              <span className="type-label-micro text-ink-muted">{r.cut}</span>
              <span className="desk-input">
                <input
                  inputMode="decimal"
                  value={rule.cutPct}
                  onChange={(e) => update(i, { cutPct: e.target.value.replace(/[^0-9.]/g, '') })}
                />
                <span aria-hidden>%</span>
              </span>
            </label>
          </div>
          <p className="type-caption text-ink-secondary">
            {r.sentence(nameOf(rule.symbol), rule.fallPct || '…', rule.cutPct || '…')}
          </p>
          <button
            type="button"
            className="type-caption text-ink-muted hover:text-ink"
            onClick={() => onChange(rules.filter((_, j) => j !== i))}
          >
            {r.remove}
          </button>
        </div>
      ))}
      {rules.length < MAX_DRAFT_RULES && (
        <button
          type="button"
          className="desk-control"
          data-cursor="hover"
          onClick={() =>
            onChange([...rules, { symbol: first, fallPct: '3', cutPct: '50', key: crypto.randomUUID() }])
          }
        >
          {r.add}
        </button>
      )}
    </div>
  )
}

/** "NVDA=300/5000,TSLA=500/2500": the shape the desk's plain-code checks read. Empty string means no rules. */
export function encodeRules(rules: DraftRule[]): string {
  return rules
    .map((r) => `${r.symbol}=${Math.round(Number(r.fallPct) * 100)}/${Math.round(Number(r.cutPct) * 100)}`)
    .join(',')
}

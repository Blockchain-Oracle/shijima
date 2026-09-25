'use client'

import { deskCopy } from '@desk/shared'
import { Plus, Trash2 } from 'lucide-react'
import { TokenLogo } from '@/components/ui/token-logo'
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
  const update = (i: number, patch: Partial<DraftRule>) =>
    onChange(rules.map((rule, j) => (j === i ? { ...rule, ...patch } : rule)))
  const first = tokens[0]?.symbol ?? ''
  return (
    <div className={cn('rule-list', className)}>
      <p className="rule-hint">{r.hint}</p>
      {rules.map((rule, i) => (
        <div key={rule.key ?? `${rule.symbol}:${rule.fallPct}:${rule.cutPct}`} className="rule-row">
          <span className="rule-word">{r.if}</span>
          <span className="rule-select">
            <TokenLogo symbol={rule.symbol} size={18} />
            <select
              aria-label={r.stock}
              value={rule.symbol}
              onChange={(e) => update(i, { symbol: e.target.value })}
            >
              {tokens.map((t) => (
                <option key={t.symbol} value={t.symbol}>
                  {t.name}
                </option>
              ))}
            </select>
          </span>
          <span className="rule-word">{r.fall}</span>
          <span className="rule-num">
            <input
              inputMode="decimal"
              aria-label={r.fall}
              value={rule.fallPct}
              onChange={(e) => update(i, { fallPct: e.target.value.replace(/[^0-9.]/g, '') })}
            />
            %
          </span>
          <span className="rule-word">{r.cut}</span>
          <span className="rule-num">
            <input
              inputMode="decimal"
              aria-label={r.cut}
              value={rule.cutPct}
              onChange={(e) => update(i, { cutPct: e.target.value.replace(/[^0-9.]/g, '') })}
            />
            %
          </span>
          <button
            type="button"
            className="rule-delete"
            aria-label={r.remove}
            title={r.remove}
            onClick={() => onChange(rules.filter((_, j) => j !== i))}
          >
            <Trash2 className="size-4" aria-hidden="true" />
          </button>
        </div>
      ))}
      {rules.length < MAX_DRAFT_RULES && (
        <button
          type="button"
          className="rule-add"
          data-cursor="hover"
          onClick={() =>
            onChange([...rules, { symbol: first, fallPct: '3', cutPct: '50', key: crypto.randomUUID() }])
          }
        >
          <Plus className="size-4" aria-hidden="true" />
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

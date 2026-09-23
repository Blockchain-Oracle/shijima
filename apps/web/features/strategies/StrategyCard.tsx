'use client'

import { CASH_LOOK, lookOf, studioCopy } from '@desk/shared'
import { motion, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'
import { AllocationDonut, type DonutSlice } from '@/components/ui/allocation-donut'
import { Sparkline } from '@/components/ui/sparkline'
import { TokenLogo, TokenStack } from '@/components/ui/token-logo'
import { cn } from '@/lib/utils'
import type { DraftToken } from './draft'

const F = studioCopy.from

/** A mix as donut slices, heaviest first, with cash last in its quiet grey. */
export function mixSlices(
  weights: Record<string, number>,
  cashBps: number,
  tokens: DraftToken[],
): DonutSlice[] {
  const held = tokens
    .filter((t) => (weights[t.symbol] ?? 0) > 0)
    .map((t) => ({
      symbol: t.symbol,
      label: t.name,
      pct: (weights[t.symbol] ?? 0) / 100,
      color: lookOf(t.symbol).color,
    }))
    .sort((a, b) => b.pct - a.pct)
  return cashBps > 0
    ? [...held, { symbol: 'CASH', label: studioCopy.side.cash, pct: cashBps / 100, color: CASH_LOOK.color }]
    : held
}

export interface Performance {
  changePct: number | null
  spark: number[]
  days: number
}

/**
 * One basket as a card: whose logos are in it, how it splits, who it suits, and what it did over the price
 * log's last month. Built from 21st pieces (Avatar Stack 28355, Sectors Donut 20086) inside our own card.
 */
export function StrategyCard({
  name,
  description,
  suits,
  weights,
  cashBps,
  tokens,
  performance,
  action,
  index = 0,
  selected = false,
}: {
  name: string
  description?: string
  suits?: string
  weights: Record<string, number>
  cashBps: number
  tokens: DraftToken[]
  performance?: Performance | undefined
  action: ReactNode
  index?: number
  selected?: boolean
}) {
  const reduced = useReducedMotion()
  const slices = mixSlices(weights, cashBps, tokens)
  const symbols = slices.filter((s) => s.symbol !== 'CASH').map((s) => s.symbol)
  const change = performance?.changePct ?? null
  return (
    <motion.article
      initial={reduced ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1], delay: reduced ? 0 : index * 0.05 }}
      {...(reduced ? {} : { whileHover: { y: -3 } })}
      className={cn(
        'group flex flex-col gap-4 rounded-[var(--radius-lg)] border bg-card p-5 transition-colors duration-200',
        selected
          ? 'border-[var(--color-accent)] bg-[var(--color-accent-wash)]'
          : 'border-border hover:border-[var(--color-border-strong)]',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <TokenStack symbols={symbols} size={30} max={4} />
        <AllocationDonut slices={slices} size={44} thickness={6} />
      </div>

      <div className="flex flex-col gap-1.5">
        <h3 className="font-[family-name:var(--font-heading)] text-[17px] font-bold leading-tight tracking-[-0.01em] text-foreground">
          {name}
        </h3>
        {suits && (
          <p className="font-[family-name:var(--font-data)] text-[10.5px] uppercase tracking-[0.12em] text-[var(--color-accent)]">
            {F.suits}: {suits}
          </p>
        )}
        {description && <p className="text-[13px] leading-snug text-muted-foreground">{description}</p>}
      </div>

      {performance && (
        <div className="flex items-end justify-between gap-3 border-t border-border pt-4">
          <div>
            <p
              className={cn(
                'font-[family-name:var(--font-data)] text-[20px] font-semibold tabular-nums leading-none',
                change === null
                  ? 'text-muted-foreground'
                  : change >= 0
                    ? 'text-[var(--profit)]'
                    : 'text-[var(--loss)]',
              )}
            >
              {change === null ? '—' : `${change >= 0 ? '+' : '−'}${Math.abs(change).toFixed(1)}%`}
            </p>
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              {change === null ? F.pastNone : F.past(performance.days)}
            </p>
          </div>
          <Sparkline values={performance.spark} width={104} height={34} />
        </div>
      )}

      <ul className="flex flex-wrap gap-1.5" aria-label={name}>
        {slices.slice(0, 5).map((s) => (
          <li
            key={s.symbol}
            className="inline-flex items-center gap-1.5 rounded-full border border-border py-0.5 pr-2 pl-0.5 text-[11px] text-foreground/75"
          >
            <TokenLogo symbol={s.symbol} size={16} />
            <span>{s.symbol === 'CASH' ? studioCopy.side.cash : s.symbol}</span>
            <span className="font-[family-name:var(--font-data)] text-muted-foreground tabular-nums">
              {Math.round(s.pct)}%
            </span>
          </li>
        ))}
        {slices.length > 5 && (
          <li className="inline-flex items-center rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
            {F.more(slices.length - 5)}
          </li>
        )}
      </ul>

      <div className="mt-auto pt-1">{action}</div>
    </motion.article>
  )
}

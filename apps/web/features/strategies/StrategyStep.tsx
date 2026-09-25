'use client'

import { appCopy, type Preset, studioCopy } from '@desk/shared'
import { ArrowDownAZ, Check, Flame, Plus, Search, ShieldCheck, TrendingUp } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Pick } from '@/components/ui/pick'
import { TokenStack } from '@/components/ui/token-logo'
import { cn } from '@/lib/utils'
import { type DraftToken, type StudioDraft, withPreset } from './draft'
import type { Performance } from './StrategyCard'
import { BasketStep } from './StudioFields'

const F = studioCopy.flow
const TAGS = appCopy.catalog.tags
type Sort = 'popular' | 'best' | 'calm' | 'name'

/**
 * Step 1: pick a strategy. A search box, a sort and the category chips over a compact list, each row its stocks'
 * logos, its name, one line and its last 30 days; "Build your own" at the end opens the stock picker.
 */
export function StrategyStep({
  draft,
  setDraft,
  presets,
  tokens,
  performance,
}: {
  draft: StudioDraft
  setDraft: (update: (d: StudioDraft) => StudioDraft) => void
  presets: Preset[]
  tokens: DraftToken[]
  performance: Record<string, Performance>
}) {
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<Sort>('popular')
  const [tag, setTag] = useState<string | null>(null)
  const own = draft.preset === null

  const tags = useMemo(() => [...new Set(presets.flatMap((p) => p.tags))], [presets])
  const nameOf = useMemo(() => new Map(tokens.map((t) => [t.symbol, t.name])), [tokens])

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = presets.filter((p) => {
      if (tag && !p.tags.includes(tag as never)) return false
      if (!q) return true
      const hay = [
        p.name,
        p.description,
        ...Object.keys(p.weights),
        ...Object.keys(p.weights).map((s) => nameOf.get(s) ?? ''),
      ]
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
    const change = (p: Preset) => performance[p.id]?.changePct ?? Number.NEGATIVE_INFINITY
    if (sort === 'best') return [...list].sort((a, b) => change(b) - change(a))
    if (sort === 'calm') return [...list].sort((a, b) => b.cashBps - a.cashBps)
    if (sort === 'name') return [...list].sort((a, b) => a.name.localeCompare(b.name))
    return list
  }, [presets, query, sort, tag, performance, nameOf])

  return (
    <div className="na-stack">
      <div className="na-tools">
        <label className="na-search">
          <Search aria-hidden="true" className="size-4" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={F.search}
            aria-label={F.search}
          />
        </label>
        <Pick<Sort>
          value={sort}
          onChange={setSort}
          label={F.sort}
          className="na-sort"
          options={[
            { value: 'popular', label: F.sorts.popular ?? '', icon: <Flame className="size-4" /> },
            { value: 'best', label: F.sorts.best ?? '', icon: <TrendingUp className="size-4" /> },
            { value: 'calm', label: F.sorts.calm ?? '', icon: <ShieldCheck className="size-4" /> },
            { value: 'name', label: F.sorts.name ?? '', icon: <ArrowDownAZ className="size-4" /> },
          ]}
        />
      </div>

      <div className="na-chips" role="toolbar" aria-label={F.sort}>
        <button type="button" className={cn('na-chip', tag === null && 'is-on')} onClick={() => setTag(null)}>
          {F.all}
        </button>
        {tags.map((t) => (
          <button
            key={t}
            type="button"
            className={cn('na-chip', tag === t && 'is-on')}
            onClick={() => setTag(tag === t ? null : t)}
          >
            {TAGS[t] ?? t}
          </button>
        ))}
      </div>

      <div className="na-list" role="radiogroup" aria-label={studioCopy.flow.sort}>
        {shown.length === 0 && <p className="na-empty">{F.noMatch}</p>}
        {shown.map((p) => {
          const on = draft.preset === p.id
          const held = Object.entries(p.weights)
            .sort((a, b) => b[1] - a[1])
            .map(([s]) => s)
          const pct = performance[p.id]?.changePct ?? null
          return (
            // biome-ignore lint/a11y/useSemanticElements: a whole row is the choice; role and state make it a radio.
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={on}
              className={cn('na-row', on && 'is-on')}
              onClick={() => setDraft((d) => withPreset(d, p))}
            >
              <TokenStack symbols={held} size={28} max={3} className="na-row-logos" />
              <span className="na-row-text">
                <span className="na-row-name">{p.name}</span>
                <span className="na-row-sub">{p.description}</span>
              </span>
              <span className={cn('na-row-pct', pct !== null && (pct >= 0 ? 'is-up' : 'is-down'))}>
                {pct === null ? '—' : `${pct >= 0 ? '+' : '−'}${Math.abs(pct).toFixed(1)}%`}
                <small>{studioCopy.identity.monthShort}</small>
              </span>
              <span className="na-row-check" aria-hidden="true">
                {on && <Check className="size-3.5" />}
              </span>
            </button>
          )
        })}
        {/* biome-ignore lint/a11y/useSemanticElements: the same radio row as the strategies above. */}
        <button
          type="button"
          role="radio"
          aria-checked={own}
          className={cn('na-row na-row--own', own && 'is-on')}
          onClick={() => setDraft((d) => ({ ...d, preset: null }))}
        >
          <span className="na-row-plus" aria-hidden="true">
            <Plus className="size-4" />
          </span>
          <span className="na-row-text">
            <span className="na-row-name">{F.ownTitle}</span>
            <span className="na-row-sub">{F.ownBody}</span>
          </span>
          <span className="na-row-check" aria-hidden="true">
            {own && <Check className="size-3.5" />}
          </span>
        </button>
      </div>

      {own && <BasketStep draft={draft} setDraft={setDraft} tokens={tokens} />}
    </div>
  )
}

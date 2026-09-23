'use client'

import { appCopy, PRESET_TAGS, type Preset, type PresetTag } from '@desk/shared'
import { ArrowRight, Plus } from 'lucide-react'
import type { Route } from 'next'
import Link from 'next/link'
import { useState } from 'react'
import type { DraftToken } from '@/features/strategies/draft'
import { type Performance, StrategyCard } from '@/features/strategies/StrategyCard'
import { cn } from '@/lib/utils'

/**
 * The twenty strategies as a catalog: filter chips, then a grid of cards with each basket's logos, mix, 30-day
 * return and how many agents run it now. Choosing one opens the studio with it filled in.
 */
export function StrategyCatalog({
  presets,
  tokens,
  performance,
  usage,
}: {
  presets: Preset[]
  tokens: DraftToken[]
  performance: Record<string, Performance>
  usage: Record<string, number>
}) {
  const c = appCopy.catalog
  const [tag, setTag] = useState<PresetTag | 'all'>('all')
  const shown = tag === 'all' ? presets : presets.filter((p) => p.tags.includes(tag))
  return (
    <div className="app-container">
      <header className="ov-head">
        <div>
          <p className="ov-kicker">{c.kicker}</p>
          <h1 className="ov-title">
            {c.title} <span className="cat-count">{presets.length}</span>
          </h1>
          <p className="ag-intro">{c.intro}</p>
        </div>
      </header>

      <fieldset className="cat-chips" aria-label={c.title}>
        {(['all', ...PRESET_TAGS] as const).map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={tag === t}
            className={cn('cat-chip', tag === t && 'is-on')}
            onClick={() => setTag(t)}
          >
            {t === 'all' ? c.all : (c.tags[t] ?? t)}
          </button>
        ))}
      </fieldset>

      <div className="cat-grid">
        {shown.map((p, i) => (
          <StrategyCard
            key={p.id}
            index={i}
            name={p.name}
            description={p.description}
            suits={p.suits}
            weights={p.weights}
            cashBps={p.cashBps}
            tokens={tokens}
            performance={performance[p.id]}
            action={
              <span className="cat-foot">
                <small>{c.running(usage[p.id] ?? 0)}</small>
                <Link href={`/agents/new?preset=${p.id}` as Route} className="cat-start">
                  {c.start} <ArrowRight aria-hidden="true" className="size-4" />
                </Link>
              </span>
            }
          />
        ))}
        <Link href="/agents/new" className="cat-own">
          <Plus aria-hidden="true" className="size-5" />
          {c.own}
        </Link>
      </div>
      <p className="cat-note">{c.notAdvice}</p>
    </div>
  )
}

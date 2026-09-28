'use client'

import { CASH_LOOK, deskCopy, lookOf, settingsCopy } from '@desk/shared'
import { PencilLine } from 'lucide-react'
import { useState } from 'react'
import { AllocationDonut, type DonutSlice } from '@/components/ui/allocation-donut'
import { TokenLogo, TokenStack } from '@/components/ui/token-logo'
import { ControlDialog, type ControlsView } from '@/features/desk/DeskControls'
import type { DeskView } from '@/lib/desk.server'

type Plan = NonNullable<DeskView['mandate']>
const p = settingsCopy.plan

const pct = (bps: number) => `${(bps / 100).toLocaleString('en-US', { maximumFractionDigits: 1 })}%`
const usd = (raw: string) =>
  `$${(Number(raw) / 1e6).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`

/**
 * The Plan tab: what the agent was told, drawn rather than listed. The basket as 21st's Sectors Donut (22247) beside
 * one row per stock with its real logo and a bar to its target, then the limits as 21st's Stats Grid (29195)
 * bordered cells, then the owner's notes. One button opens the same edit card the chat would make.
 */
export function PlanPanel({ plan, controls }: { plan: Plan; controls: ControlsView | null }) {
  const [editing, setEditing] = useState(false)
  const names = new Map(controls?.tokens.map((t) => [t.symbol, t.name]) ?? [])
  const rows = [...plan.targets].sort((a, b) => b.weightBps - a.weightBps)
  const slices: DonutSlice[] = [
    ...rows.map((t) => ({
      symbol: t.symbol,
      label: names.get(t.symbol) ?? t.symbol,
      pct: t.weightBps / 100,
      color: lookOf(t.symbol).color,
    })),
    ...(plan.cashTargetBps > 0
      ? [{ symbol: 'CASH', label: p.cash, pct: plan.cashTargetBps / 100, color: CASH_LOOK.color }]
      : []),
  ]
  const widest = Math.max(plan.cashTargetBps, ...rows.map((t) => t.weightBps), 1)
  const limits: [string, string, string][] = [
    [p.perTrade, usd(plan.perActionCapUsdg), p.perTradeNote],
    [p.perDay, usd(plan.dailyCapUsdg), p.perDayNote],
    [p.drift, pct(plan.driftToleranceBps), p.driftNote],
    [p.position, pct(plan.maxPositionBps), p.positionNote],
    [p.loss, pct(plan.lossStopBps), p.lossNote],
    [p.large, usd(plan.largeActionUsdg), p.largeNote],
  ]

  return (
    <div className="st-stack">
      <section className="st-section pl-basket">
        <header className="pl-head">
          <TokenStack symbols={rows.map((t) => t.symbol)} max={6} size={30} />
          <div className="pl-head-text">
            <span className="pl-kicker">{p.strategy}</span>
            <h3>{plan.preset ?? deskCopy.mandate.own}</h3>
          </div>
          <span className="pl-version">{deskCopy.mandate.version(plan.version)}</span>
          {controls && (
            <button type="button" className="pl-edit" onClick={() => setEditing(true)}>
              <PencilLine aria-hidden="true" className="size-4" />
              {p.edit}
            </button>
          )}
        </header>
        <div className="pl-body">
          <AllocationDonut
            slices={slices}
            size={168}
            center={String(rows.length)}
            caption={rows.length === 1 ? p.stock : p.stocks}
          />
          <ul className="pl-rows">
            {rows.map((t) => (
              <li key={t.symbol}>
                <TokenLogo symbol={t.symbol} size={32} />
                <span className="pl-name">
                  <b>{names.get(t.symbol) ?? t.symbol}</b>
                  <small>{t.symbol}</small>
                </span>
                <span className="pl-bar" aria-hidden="true">
                  <i
                    style={{
                      width: `${(t.weightBps / widest) * 100}%`,
                      background: lookOf(t.symbol).color,
                    }}
                  />
                </span>
                <span className="pl-pct">{pct(t.weightBps)}</span>
              </li>
            ))}
            {plan.cashTargetBps > 0 && (
              <li>
                <TokenLogo symbol="USDG" size={32} />
                <span className="pl-name">
                  <b>{p.cash}</b>
                  <small>USDG</small>
                </span>
                <span className="pl-bar" aria-hidden="true">
                  <i
                    style={{ width: `${(plan.cashTargetBps / widest) * 100}%`, background: CASH_LOOK.color }}
                  />
                </span>
                <span className="pl-pct">{pct(plan.cashTargetBps)}</span>
              </li>
            )}
          </ul>
        </div>
      </section>

      <section className="st-section">
        <div className="st-section-head">{p.limitsTitle}</div>
        <div className="pl-limits">
          {limits.map(([label, value, note]) => (
            <div key={label}>
              <span className="pl-limit-value">{value}</span>
              <span className="pl-limit-label">{label}</span>
              <small>{note}</small>
            </div>
          ))}
        </div>
      </section>

      {plan.rules.length > 0 && (
        <section className="st-section">
          <div className="st-section-head">{deskCopy.rules.title}</div>
          {plan.rules.map((r) => (
            <div key={`${r.symbol}-${r.fallBps}`} className="st-row pl-rule">
              <TokenLogo symbol={r.symbol} size={24} />
              <span>{p.rule(r.symbol, pct(r.fallBps), pct(r.cutBps))}</span>
            </div>
          ))}
        </section>
      )}

      <section className="st-section st-section--pad pl-notes">
        <span className="pl-kicker">{deskCopy.mandate.notes}</span>
        <p>{plan.notes || p.noNotes}</p>
      </section>

      {controls && (
        <ControlDialog
          key={editing ? 'edit' : 'none'}
          view={controls}
          form={editing ? 'editMandate' : null}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  )
}

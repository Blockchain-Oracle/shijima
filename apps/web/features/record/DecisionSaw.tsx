import { tokenByAddress } from '@desk/chain'
import { ago, decisionCopy as c, comparedTo, money, percent, type RecordView } from '@desk/shared'
import { ArrowRight, Check, CircleCheck, CircleX, Newspaper, OctagonAlert, X } from 'lucide-react'
import { TokenLogo } from '@/components/ui/token-logo'
import { PriceStrip } from './PriceStrip'

/** One labelled fact: label left, value right on a wide screen, stacked on a phone. */
function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="dc-fact">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

/**
 * Sections 3 to 6 of one decision [8.11], drawn after Agari's S22 decision page: what it saw as one price line and
 * a short list of facts, the options it weighed as cards with the chosen one raised, the limits as a checklist,
 * and the cost as money flowing from one side to the other.
 */
export function WhatItSaw({
  body,
  now,
  whose,
}: {
  body: RecordView
  now: Date
  vaultMove: boolean
  whose: string
}) {
  const feeOf = (bps: number) => `${bps / 10_000}%`
  return (
    <>
      {body.price ? <PriceStrip price={body.price} /> : null}
      <dl className="dc-facts">
        {body.session ? (
          <Fact label={c.session}>
            {body.session.session} · {body.session.anchored ? c.anchored : c.unanchored}
          </Fact>
        ) : null}
        {body.price ? (
          <Fact label={c.reference(body.price.referenceLabel)}>
            ${body.price.referencePrice} · {c.set(ago(new Date(body.price.referenceAt), now))}
            {body.price.poolPrice ? ` · the pool was ${comparedTo(body.price.gapBps)} it` : ''}
          </Fact>
        ) : null}
        {body.cost ? (
          <Fact label={c.costLabel}>
            {percent(body.cost.costBps, 2)} ·{' '}
            {body.cost.measured
              ? c.costMeasured(feeOf(body.cost.feeTierBps))
              : c.costTable(feeOf(body.cost.feeTierBps))}
          </Fact>
        ) : null}
        {body.status ? (
          <Fact label={c.status}>
            {body.status.tradingHalt === null ? c.haltUnknown : body.status.tradingHalt ? c.halted : c.open}
            {body.status.oraclePaused ? c.oraclePaused : ''}
          </Fact>
        ) : null}
        {body.event ? (
          <Fact label={c.event}>
            {c.eventLine(
              c.eventKinds[body.event.eventKind] ?? c.eventKinds.other ?? '',
              body.event.eventDate,
              body.event.timing ? (c.eventTiming[body.event.timing] ?? null) : null,
              body.event.daysAway,
            )}
          </Fact>
        ) : null}
        {body.vault ? (
          <Fact label={c.vaultLabel}>
            {body.vault.netApyBps === null
              ? c.vaultRateUnknown
              : c.vaultRate(percent(body.vault.netApyBps, 2))}
            {body.vault.liquidityUsdg ? c.vaultLiquidity(money(body.vault.liquidityUsdg)) : ''}
            {c.vaultKeep(money(body.vault.keepUsdg))}
          </Fact>
        ) : null}
        {body.limits ? (
          <Fact label={c.limitsAt(whose)}>
            {c.limitsLine(
              money(body.limits.perActionCapUsdg),
              money(body.limits.remainingTodayUsdg),
              money(body.limits.deskUsdg),
            )}
          </Fact>
        ) : null}
      </dl>
      {body.news ? (
        <div className="flex flex-col gap-2">
          <span className="dc-subhead">
            {body.news.available ? c.headlines(body.news.count) : c.newsUnavailable}
          </span>
          {body.news.items.length > 0 ? (
            <div className="dc-news">
              {body.news.items.slice(0, 3).map((h) => (
                <a key={h.id} href={h.url} rel="noreferrer noopener" target="_blank">
                  <Newspaper className="size-3.5" aria-hidden />
                  {h.source} · {ago(new Date(h.publishedAt), now)}
                </a>
              ))}
            </div>
          ) : null}
          {body.news.count > 0 ? <p className="type-caption text-ink-muted">{c.noHeadlineText}</p> : null}
        </div>
      ) : null}
      {body.blockers?.length ? (
        <div className="dc-blockers">
          {body.blockers.map((b) => (
            <p key={b.rule} className="dc-blocker">
              <OctagonAlert aria-hidden />
              {b.text}
            </p>
          ))}
        </div>
      ) : null}
    </>
  )
}

export function Options({
  body,
  vaultMove,
  summary,
}: {
  body: RecordView | undefined
  vaultMove: boolean
  summary: string
}) {
  const model = body?.serv?.decision
  if (!model)
    return (
      <p className="type-body text-ink-secondary">
        {c.noModelAsked} {vaultMove ? c.vaultNoModel : (body?.blockers?.[0]?.text ?? summary)}
      </p>
    )
  const headline = 'headline' in model && typeof model.headline === 'string' ? model.headline : null
  return (
    <div className="dc-options">
      <div className="dc-option" data-chosen="">
        <span className="dc-option-head">
          <span className="dc-option-name">
            {c.options[model.option] ?? model.option}
            {model.partPercent ? ` · ${model.partPercent}%` : ''}
          </span>
          <span className="dc-badge" data-tone="chosen">
            <Check aria-hidden />
            {c.chosen}
          </span>
        </span>
        {headline ? <p className="dc-option-headline">{headline}</p> : null}
        {model.reasons.length > 0 ? (
          <ul className="dc-reasons">
            {model.reasons.map((r) => (
              <li key={r.text}>{r.text}</li>
            ))}
          </ul>
        ) : null}
      </div>
      {model.rejected.length > 0 ? (
        <div className="dc-options-rest">
          {model.rejected.map((r) => (
            <div key={r.option} className="dc-option">
              <span className="dc-option-head">
                <span className="dc-option-name">{c.options[r.option] ?? r.option}</span>
                <span className="dc-badge">
                  <X aria-hidden />
                  {c.turnedDown}
                </span>
              </span>
              <p className="type-caption text-ink-secondary">{r.reason}</p>
            </div>
          ))}
        </div>
      ) : null}
      {model.warnings.length ? (
        <div className="dc-blockers">
          {model.warnings.map((w) => (
            <p key={w} className="dc-blocker">
              <OctagonAlert aria-hidden />
              {w}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function CheckRow({ ok, label, value }: { ok: boolean; label: string; value: string }) {
  return (
    <li className="dc-check" data-ok={ok ? '' : undefined}>
      {ok ? <CircleCheck aria-hidden /> : <CircleX aria-hidden />}
      <span>{label}</span>
      <b>{value}</b>
    </li>
  )
}

export function LimitsCheck({ body, vaultMove }: { body: RecordView | undefined; vaultMove: boolean }) {
  const g = body?.gate
  return (
    <>
      <p className="type-caption text-ink-muted">{c.arithmetic}</p>
      {!g ? (
        <p className="type-body text-ink-secondary">{c.nothingToCheck}</p>
      ) : (
        <>
          <p className="dc-gate" data-ok={g.result === 'allow' ? '' : undefined}>
            {g.result === 'allow' ? <CircleCheck aria-hidden /> : <CircleX aria-hidden />}
            {g.result === 'allow'
              ? vaultMove
                ? c.vaultNoLimits
                : c.everyLimitPassed
              : c.refused(g.reasons.join('; '))}
          </p>
          <ul className="dc-checks">
            {g.reasons.map((r) => (
              <CheckRow key={r} ok={false} label={r} value={c.checks.refused} />
            ))}
            {!vaultMove ? (
              <CheckRow ok={g.result === 'allow'} label={c.checks.counted} value={money(g.countedUsdg)} />
            ) : null}
          </ul>
        </>
      )}
    </>
  )
}

/** A token amount a person can read: six significant figures, never sixteen decimals. Exact bytes stay in the record. */
const amount = (decimal: string) => {
  const n = Number(decimal)
  return Number.isFinite(n) ? n.toLocaleString('en-US', { maximumSignificantDigits: 6 }) : decimal
}

function Leg({ symbol, label, value }: { symbol: string; label: string; value: string }) {
  return (
    <div className="dc-leg">
      <TokenLogo symbol={symbol} size={36} />
      <span className="dc-leg-text">
        <span className="dc-leg-label">{label}</span>
        <b>{value}</b>
      </span>
    </div>
  )
}

export function CostShown({ body, vaultMove }: { body: RecordView; vaultMove: boolean }) {
  const p = body.preview
  const cand = body.candidate
  if (!p || !cand) return null
  const name = tokenByAddress(cand.token)?.displayName ?? cand.symbol
  const sell = cand.side === 'sell'
  const spend =
    sell || cand.side === 'redeem' ? `${amount(p.amountIn)} ${cand.amountInUnit}` : money(p.amountIn)
  const receive = vaultMove
    ? cand.side === 'sweep'
      ? `${amount(p.expectedOut)} ${c.vaultShares}`
      : `${money(p.expectedOut)} USDG`
    : sell
      ? `${money(p.expectedOut)} USDG`
      : `${amount(p.expectedOut)} ${name}`
  return (
    <div className="dc-cost">
      <div className="dc-flow">
        <Leg symbol={sell ? cand.symbol : 'CASH'} label={c.spend} value={spend} />
        <span className="dc-flow-arrow" aria-hidden>
          <ArrowRight />
        </span>
        <Leg symbol={sell || vaultMove ? 'CASH' : cand.symbol} label={c.receive} value={receive} />
      </div>
      <dl className="dc-facts">
        <Fact label={c.least}>
          {vaultMove ? c.vaultLeast : sell ? money(p.minOut) : `${amount(p.minOut)} ${name}`}
        </Fact>
        <Fact label={c.slippage}>{vaultMove ? c.vaultSlippage : percent(p.slippageBps, 2)}</Fact>
      </dl>
    </div>
  )
}

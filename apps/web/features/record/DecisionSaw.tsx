import { ago, decisionCopy as c, comparedTo, money, percent, type RecordView } from '@desk/shared'

/** One labelled fact on the decision page. */
function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd className="type-body text-ink">{children}</dd>
    </div>
  )
}

/** Sections 3 to 6 of one decision [8.11]: what it saw, the options it weighed, the limits check, the cost. */
export function WhatItSaw({
  body,
  now,
  vaultMove,
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
      <dl className="decision-grid is-two">
        {body.session ? (
          <Fact label={c.session}>
            {body.session.session} · {body.session.anchored ? c.anchored : c.unanchored}
          </Fact>
        ) : null}
        {body.price?.poolPrice ? (
          <Fact label={c.tradingPrice}>
            ${body.price.poolPrice}{' '}
            <span className="text-ink-secondary">
              ({comparedTo(body.price.gapBps)} {c.theReference})
            </span>
          </Fact>
        ) : null}
        {body.price ? (
          <Fact label={c.reference(body.price.referenceLabel)}>
            ${body.price.referencePrice}{' '}
            <span className="text-ink-secondary">
              {c.set(ago(new Date(body.price.referenceAt), now))}
              {body.price.poolPrice ? '' : c.priceWas(comparedTo(body.price.gapBps))}
            </span>
          </Fact>
        ) : null}
        {body.price && body.price.referenceLabel === 'this pool at the last close' ? (
          <Fact label={c.lastOfficial}>
            ${body.price.lastOfficialUpdate}{' '}
            <span className="text-ink-secondary">
              {c.set(ago(new Date(body.price.lastOfficialUpdateAt), now))}
              {c.poolIs(comparedTo(body.price.gapToLastOfficialUpdateBps, 1))}
            </span>
          </Fact>
        ) : null}
        {body.cost ? (
          <Fact label={c.costLabel}>
            {percent(body.cost.costBps, 2)}{' '}
            <span className="text-ink-secondary">
              {body.cost.measured
                ? c.costMeasured(feeOf(body.cost.feeTierBps))
                : c.costTable(feeOf(body.cost.feeTierBps))}
            </span>
          </Fact>
        ) : null}
        {body.status ? (
          <Fact label={c.status}>
            {body.status.tradingHalt === null ? c.haltUnknown : body.status.tradingHalt ? c.halted : c.open}
            {body.status.oraclePaused ? c.oraclePaused : ''}
          </Fact>
        ) : null}
        {body.position ? (
          <Fact label={c.holding}>
            {c.holdingLine(
              percent(body.position.weightBps),
              percent(body.position.targetBps),
              percent(body.position.thresholdBps),
            )}
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
            {body.vault.roundTripFeeUsdg ? c.vaultFee(money(body.vault.roundTripFeeUsdg)) : ''}
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
        <div className="flex flex-col gap-1">
          <p className="type-caption text-ink-muted">
            {body.news.available ? c.headlines(body.news.count) : c.newsUnavailable}
          </p>
          <ul className="flex flex-col gap-1">
            {body.news.items.slice(0, 3).map((h) => (
              <li key={h.id} className="type-caption">
                <a href={h.url} className="text-accent hover:underline" rel="noreferrer noopener">
                  {h.source}
                </a>
                <span className="text-ink-muted"> · {ago(new Date(h.publishedAt), now)}</span>
              </li>
            ))}
          </ul>
          {body.news.count > 0 ? <p className="type-caption text-ink-muted">{c.noHeadlineText}</p> : null}
        </div>
      ) : null}
      {vaultMove ? null : null}
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
  return (
    <>
      <ul className="flex flex-col gap-2">
        <li className="decision-option is-chosen">
          <span className="type-body-strong text-acted">{c.options[model.option] ?? model.option}</span>
          <span className="type-caption text-ink-muted"> · {c.chosen}</span>
          <ul className="mt-1 flex flex-col gap-1">
            {model.reasons.map((r) => (
              <li key={r.text} className="type-body text-ink-secondary">
                {r.text}
              </li>
            ))}
          </ul>
        </li>
        {model.rejected.map((r) => (
          <li key={r.option} className="decision-option">
            <span className="type-body-strong text-ink-secondary">{c.options[r.option] ?? r.option}</span>
            <span className="type-caption text-ink-muted"> · {c.turnedDown}</span>
            <p className="mt-1 type-body text-ink-secondary">{r.reason}</p>
          </li>
        ))}
      </ul>
      {model.warnings.length ? (
        <ul className="flex flex-col gap-1">
          {model.warnings.map((w) => (
            <li key={w} className="type-caption text-blocked">
              {w}
            </li>
          ))}
        </ul>
      ) : null}
    </>
  )
}

export function LimitsCheck({ body, vaultMove }: { body: RecordView | undefined; vaultMove: boolean }) {
  return (
    <>
      <p className="type-caption text-ink-muted">{c.arithmetic}</p>
      {body?.gate ? (
        <p className={body.gate.result === 'allow' ? 'type-body text-acted' : 'type-body text-blocked'}>
          {body.gate.result === 'allow'
            ? vaultMove
              ? c.vaultNoLimits
              : c.everyLimitPassed
            : c.refused(body.gate.reasons.join('; '))}
        </p>
      ) : (
        <p className="type-body text-ink-secondary">{c.nothingToCheck}</p>
      )}
      {body?.blockers?.length ? (
        <ul className="flex flex-col gap-1">
          {body.blockers.map((b) => (
            <li key={b.rule} className="type-body text-blocked">
              {b.text}
            </li>
          ))}
        </ul>
      ) : null}
    </>
  )
}

export function CostShown({ body, vaultMove }: { body: RecordView; vaultMove: boolean }) {
  const p = body.preview
  if (!p) return null
  return (
    <dl className="decision-grid is-two">
      <Fact label={c.spend}>
        {p.amountIn} {body.candidate?.amountInUnit}
      </Fact>
      <Fact label={c.receive}>
        {p.expectedOut}
        {vaultMove ? (body.candidate?.side === 'sweep' ? ` ${c.vaultShares}` : ' USDG') : ''}
      </Fact>
      <Fact label={c.least}>{vaultMove ? c.vaultLeast : p.minOut}</Fact>
      <Fact label={c.slippage}>{vaultMove ? c.vaultSlippage : percent(p.slippageBps, 2)}</Fact>
    </dl>
  )
}

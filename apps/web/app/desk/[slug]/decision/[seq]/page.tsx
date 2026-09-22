import { EXPLORER } from '@desk/chain'
import { decisionInFull, deskByShareSlug } from '@desk/db'
import { ago, comparedTo, localTime, money, percent, short, signedPercent, viewRecord } from '@desk/shared'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CheckIt } from '@/components/check-it'
import { Outcome, outcomeLabel } from '@/components/outcome'
import { decisionCard } from '@/features/share/card-data'
import { ShareDecisionButton } from '@/features/share/ShareDecisionButton'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

const OPTIONS: Record<string, string> = {
  ACT_NOW: 'Do it now',
  ACT_PART: 'Do part of it now',
  WAIT_REOPEN: 'Wait for the market to reopen',
  DECLINE: 'Do not do it',
}

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="border-line border-t pt-5">
      <h2 className="font-medium text-ink-soft text-sm uppercase tracking-wide">
        <span className="tabular mr-2 text-ink-faint">{n}</span>
        {title}
      </h2>
      <div className="mt-3 space-y-2 text-sm">{children}</div>
    </section>
  )
}

export default async function DecisionPage({ params }: { params: Promise<{ slug: string; seq: string }> }) {
  const { slug, seq } = await params
  const desk = await deskByShareSlug(db(), slug)
  if (!desk) notFound()
  const full = await decisionInFull(db(), desk.id, Number(seq))
  if (!full) notFound()

  const { decision, actions, grade } = full
  // One view over every record version, so an older record renders in full rather than half blank.
  const body = viewRecord(decision.record)
  const now = new Date()
  const model = body?.serv?.decision
  const vaultMove = body?.candidate?.side === 'sweep' || body?.candidate?.side === 'redeem'
  const sealTx = decision.sealedByTx ?? undefined
  const onChainHash = (decision.result as { checks?: unknown } | null) ? decision.recordHash : undefined

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <Link href={`/desk/${slug}/record`} className="text-accent text-sm hover:underline">
          ← every decision
        </Link>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h1 className="font-semibold text-2xl tracking-tight">
            {outcomeLabel(decision.outcome)}
            {body?.candidate ? (
              <span className="text-ink-soft">
                {' '}
                · {vaultMove ? 'the savings vault' : body.candidate.symbol}
              </span>
            ) : null}
          </h1>
          <span className="tabular flex items-baseline gap-3 text-ink-faint text-sm">
            <span>
              #{decision.seq} · {localTime(decision.decidedAt)}
            </span>
            <ShareDecisionButton card={decisionCard(desk, full, body)} />
          </span>
        </div>
        <p className="text-ink-soft">{decision.summary}</p>
      </header>

      <Section n={1} title="The decision">
        <dl className="grid gap-2 sm:grid-cols-3">
          <div>
            <dt className="text-ink-faint text-xs">What</dt>
            <dd>
              <Outcome outcome={decision.outcome} shadow={decision.shadow} />
            </dd>
          </div>
          <div>
            <dt className="text-ink-faint text-xs">Mode</dt>
            <dd>
              {decision.mode === 'shadow'
                ? 'Practice, spending nothing'
                : decision.mode === 'ask_first'
                  ? 'Asks before acting'
                  : 'Acts on its own'}
            </dd>
          </div>
          <div>
            <dt className="text-ink-faint text-xs">How sure</dt>
            <dd className="tabular">
              {decision.confidencePercent === null ? 'no model was asked' : `${decision.confidencePercent}%`}
            </dd>
          </div>
        </dl>
        {body?.override ? (
          <p className="rounded-md border border-blocked p-2 text-blocked">
            This was overruled by {body.override.by}: {body.override.reason} The assistant had chosen
            something else, shown below. It still could not get past your limits.
          </p>
        ) : null}
        {body?.approvalOf ? (
          <p className="text-ink-soft">
            You approved this in record #{body.approvalOf.decisionSeq}, answered{' '}
            {ago(new Date(body.approvalOf.answeredAt), now)} on the {body.approvalOf.answeredVia}. The price
            had moved {signedPercent(-body.approvalOf.movedBps)} since you were shown it.
          </p>
        ) : null}
      </Section>

      <Section n={2} title="Why it looked">
        {body?.candidate && (body.need || vaultMove) ? (
          <p>{body.candidate.why}</p>
        ) : (
          <p className="text-ink-soft">A routine hourly check.</p>
        )}
        {body?.deferral ? (
          <p className="text-ink-soft">
            It had already decided this at record #{body.deferral.decisionSeq}.{' '}
            {body.deferral.stillStanding
              ? 'Nothing measurable had changed since, so it did not ask again.'
              : (body.deferral.endedBecause ?? '')}
          </p>
        ) : null}
      </Section>

      <Section n={3} title="What it saw">
        <dl className="space-y-2">
          {body?.session ? (
            <div>
              <dt className="text-ink-faint text-xs">Market session</dt>
              <dd>
                {body.session.session}
                {body.session.anchored
                  ? ' · price anchored by market makers'
                  : ' · nothing anchors the price right now'}
              </dd>
            </div>
          ) : null}
          {body?.price ? (
            <>
              {body.price.poolPrice ? (
                <div>
                  <dt className="text-ink-faint text-xs">Trading price</dt>
                  <dd className="tabular">
                    ${body.price.poolPrice}{' '}
                    <span className="text-ink-soft">({comparedTo(body.price.gapBps)} the reference)</span>
                  </dd>
                </div>
              ) : null}
              <div>
                <dt className="text-ink-faint text-xs">Reference: {body.price.referenceLabel}</dt>
                <dd className="tabular">
                  ${body.price.referencePrice}{' '}
                  <span className="text-ink-soft">
                    set {ago(new Date(body.price.referenceAt), now)}
                    {body.price.poolPrice ? '' : `, the price was ${comparedTo(body.price.gapBps)} it`}
                  </span>
                </dd>
              </div>
              {body.price.referenceLabel === 'this pool at the last close' ? (
                <div>
                  <dt className="text-ink-faint text-xs">Last official update</dt>
                  <dd className="tabular">
                    ${body.price.lastOfficialUpdate}{' '}
                    <span className="text-ink-soft">
                      set {ago(new Date(body.price.lastOfficialUpdateAt), now)}, the pool is{' '}
                      {comparedTo(body.price.gapToLastOfficialUpdateBps, 1)} it
                    </span>
                  </dd>
                </div>
              ) : null}
            </>
          ) : null}
          {body?.cost ? (
            <div>
              <dt className="text-ink-faint text-xs">What this trade costs</dt>
              <dd className="tabular">
                {percent(body.cost.costBps, 2)}{' '}
                <span className="text-ink-soft">
                  {body.cost.measured
                    ? `(the ${body.cost.feeTierBps / 10_000}% pool fee, plus what its size moves the price)`
                    : `(the ${body.cost.feeTierBps / 10_000}% pool fee, measured at a standard size, not this trade)`}
                </span>
              </dd>
            </div>
          ) : null}
          {body?.status ? (
            <div>
              <dt className="text-ink-faint text-xs">Trading status</dt>
              <dd>
                {body.status.tradingHalt === null
                  ? 'could not be confirmed'
                  : body.status.tradingHalt
                    ? 'trading is paused in this token'
                    : 'trading is open'}
                {body.status.oraclePaused ? ' · the price feed is paused' : ''}
              </dd>
            </div>
          ) : null}
          {body?.position ? (
            <div>
              <dt className="text-ink-faint text-xs">This holding</dt>
              <dd className="tabular">
                {percent(body.position.weightBps)} of the desk against a target of{' '}
                {percent(body.position.targetBps)}, allowed to wander {percent(body.position.thresholdBps)}
              </dd>
            </div>
          ) : null}
          {body?.vault ? (
            <div>
              <dt className="text-ink-faint text-xs">The savings vault (Steakhouse USDG, on Morpho)</dt>
              <dd className="tabular">
                {body.vault.netApyBps === null
                  ? 'its rate could not be read'
                  : `pays ${percent(body.vault.netApyBps, 2)} a year after its fees`}
                {body.vault.liquidityUsdg
                  ? ` · ${money(body.vault.liquidityUsdg)} could be taken out right then`
                  : ''}
                {body.vault.roundTripFeeUsdg
                  ? ` · a deposit and a later withdrawal cost ${money(body.vault.roundTripFeeUsdg)} in network fees`
                  : ''}
                {` · the desk keeps ${money(body.vault.keepUsdg)} in cash for its own buys`}
              </dd>
            </div>
          ) : null}
          {body?.limits ? (
            <div>
              <dt className="text-ink-faint text-xs">Your limits at that moment</dt>
              <dd className="tabular">
                {money(body.limits.perActionCapUsdg)} per action · {money(body.limits.remainingTodayUsdg)}{' '}
                left today · {money(body.limits.deskUsdg)} cash in the desk
              </dd>
            </div>
          ) : null}
        </dl>
        {body?.news ? (
          <div className="pt-1">
            <p className="text-ink-faint text-xs">
              {body.news.available
                ? `Headlines naming the company in the last 72 hours (${body.news.count})`
                : 'News was unavailable at that moment'}
            </p>
            <ul className="mt-1 space-y-1">
              {body.news.items.slice(0, 3).map((h) => (
                <li key={h.id} className="text-sm">
                  <a href={h.url} className="text-accent hover:underline" rel="noreferrer noopener">
                    {h.source}
                  </a>
                  <span className="text-ink-faint"> · {ago(new Date(h.publishedAt), now)}</span>
                </li>
              ))}
            </ul>
            {body.news.count > 0 ? (
              <p className="mt-1 text-ink-faint text-xs">
                The headline text is not shown here: our news licence does not allow passing it on.
              </p>
            ) : null}
          </div>
        ) : null}
        {!body ? (
          <p className="text-ink-soft">This record cannot be read by this version of the site.</p>
        ) : null}
      </Section>

      <Section n={4} title="The options it weighed">
        {model ? (
          <ul className="space-y-2">
            <li className="rounded-md border border-acted p-2">
              <span className="font-medium text-acted">{OPTIONS[model.option] ?? model.option}</span>
              <span className="text-ink-faint text-xs"> · chosen</span>
              <ul className="mt-1 space-y-1">
                {model.reasons.map((r) => (
                  <li key={r.text} className="text-ink-soft">
                    {r.text}
                  </li>
                ))}
              </ul>
            </li>
            {model.rejected.map((r) => (
              <li key={r.option} className="rounded-md border border-line p-2">
                <span className="font-medium text-ink-soft">{OPTIONS[r.option] ?? r.option}</span>
                <span className="text-ink-faint text-xs"> · turned down</span>
                <p className="mt-1 text-ink-soft">{r.reason}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-ink-soft">
            No model was asked.{' '}
            {vaultMove
              ? 'Moving cash into or out of the savings vault is arithmetic, not a question of timing, and the money never leaves the desk.'
              : (body?.blockers?.[0]?.text ?? decision.summary)}
          </p>
        )}
        {model?.warnings.length ? (
          <ul className="space-y-1 pt-1">
            {model.warnings.map((w) => (
              <li key={w} className="text-blocked text-sm">
                {w}
              </li>
            ))}
          </ul>
        ) : null}
      </Section>

      <Section n={5} title="The limits check">
        <p className="text-ink-faint text-xs">
          This part is plain arithmetic, not an assistant. It can refuse, and it can never start anything.
        </p>
        {body?.gate ? (
          <p className={body.gate.result === 'allow' ? 'text-acted' : 'text-blocked'}>
            {body.gate.result === 'allow'
              ? vaultMove
                ? 'Nothing counts against your limits: the money stays in the desk, as the contract counts it.'
                : 'Every limit passed.'
              : `Refused: ${body.gate.reasons.join('; ')}.`}
          </p>
        ) : (
          <p className="text-ink-soft">Nothing to check: the desk was not going to act.</p>
        )}
        {body?.blockers?.length ? (
          <ul className="space-y-1">
            {body.blockers.map((b) => (
              <li key={b.rule} className="text-blocked">
                {b.text}
              </li>
            ))}
          </ul>
        ) : null}
      </Section>

      {body?.preview ? (
        <Section n={6} title="The cost, shown before acting">
          <dl className="tabular grid gap-2 sm:grid-cols-2">
            <div>
              <dt className="text-ink-faint text-xs">It would spend</dt>
              <dd>
                {body.preview.amountIn} {body.candidate?.amountInUnit}
              </dd>
            </div>
            <div>
              <dt className="text-ink-faint text-xs">It should receive</dt>
              <dd>
                {body.preview.expectedOut}
                {vaultMove ? (body.candidate?.side === 'sweep' ? ' vault shares' : ' USDG') : ''}
              </dd>
            </div>
            <div>
              <dt className="text-ink-faint text-xs">The least it would accept</dt>
              <dd>
                {vaultMove ? 'more than zero, the contract’s only rule for the vault' : body.preview.minOut}
              </dd>
            </div>
            <div>
              <dt className="text-ink-faint text-xs">Slippage allowed</dt>
              <dd>
                {vaultMove
                  ? 'none: the vault sets its own share price'
                  : percent(body.preview.slippageBps, 2)}
              </dd>
            </div>
          </dl>
        </Section>
      ) : null}

      <Section n={7} title="What happened">
        {actions.length === 0 ? (
          <p className="text-ink-soft">Nothing was sent.</p>
        ) : (
          <ul className="space-y-2">
            {actions.map((a) => (
              <li key={a.leg} className="space-y-1">
                <p>
                  <span className="font-medium">{a.kind}</span>
                  <span className="text-ink-soft"> · {a.status.replace(/_/g, ' ')}</span>
                </p>
                {a.actualOut !== null && a.expectedOut !== null ? (
                  <p className="tabular text-ink-soft">
                    received {a.actualOut.toString()} against {a.expectedOut.toString()} expected
                  </p>
                ) : null}
                {a.failureCode ? (
                  <p className="text-blocked">
                    {a.failureCode}
                    {a.failureDetail ? `: ${a.failureDetail}` : ''}
                  </p>
                ) : null}
                {a.txHash ? (
                  <a
                    href={`${EXPLORER}/tx/${a.txHash}`}
                    className="font-mono text-accent text-xs hover:underline"
                    rel="noreferrer noopener"
                  >
                    {short(a.txHash, 12, 8)}
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section n={8} title="Proof">
        <p className="text-ink-soft">
          {sealTx
            ? 'The fingerprint of this record was written on the public network, in the same transaction as the action it describes or in a later seal. Nobody can change the record now without the change being visible.'
            : 'This record is not sealed yet. The next action, or the daily seal, writes its fingerprint on the public network.'}
        </p>
        <CheckIt
          record={decision.record}
          recordHash={decision.recordHash}
          onChainHash={sealTx ? onChainHash : undefined}
          explorerUrl={sealTx ? `${EXPLORER}/tx/${sealTx}` : undefined}
        />
      </Section>

      <Section n={9} title="How it looks now">
        {grade ? (
          <p>
            {grade.verdict === 'no_real_difference'
              ? 'There was no real difference either way.'
              : grade.verdict === 'better'
                ? `This turned out better than the alternative by ${percent(Math.abs(grade.differenceBps ?? 0), 2)}.`
                : grade.verdict === 'worse'
                  ? `The alternative would have been better by ${percent(Math.abs(grade.differenceBps ?? 0), 2)}.`
                  : 'This one cannot be graded.'}
            {grade.replay ? <span className="text-ink-faint"> · from a replay of a past weekend</span> : null}
          </p>
        ) : (
          <p className="text-ink-soft">
            {vaultMove
              ? 'Never graded: a savings-vault move is not a timing call, so there is no other moment to compare it with.'
              : 'Not yet. Each decision is graded once the US market has reopened.'}
          </p>
        )}
      </Section>
    </div>
  )
}

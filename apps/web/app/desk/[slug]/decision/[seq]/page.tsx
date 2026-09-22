import { EXPLORER } from '@desk/chain'
import { decisionInFull } from '@desk/db'
import {
  ago,
  decisionCopy as c,
  percent,
  recordPagesCopy,
  short,
  signedPercent,
  until,
  viewRecord,
} from '@desk/shared'
import type { Route } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { formatEther } from 'viem'
import { CheckIt } from '@/components/check-it'
import { Outcome, outcomeLabel } from '@/components/outcome'
import { When } from '@/components/when'
import { CostShown, LimitsCheck, Options, WhatItSaw } from '@/features/record/DecisionSaw'
import { decisionCard } from '@/features/share/card-data'
import { ShareDecisionButton } from '@/features/share/ShareDecisionButton'
import { db } from '@/lib/db'
import { deskForViewer } from '@/lib/desk.server'
import { proofFor } from '@/lib/proof.server'

export const dynamic = 'force-dynamic'

/** Sections number themselves in the order they appear, so a page with nothing to ask reads 1 to 9 with no gap. */
function sectionCounter() {
  let n = 0
  return function Section({ title, children }: { title: string; children: React.ReactNode }) {
    n += 1
    return (
      <section className="desk-panel">
        <header className="desk-panel-head">
          <h2 className="type-label-micro text-ink-muted">
            <span className="mr-2 text-ink-muted">{String(n).padStart(2, '0')}</span>
            {title}
          </h2>
        </header>
        {children}
      </section>
    )
  }
}

/**
 * One decision, in full [8.11], in the brief's order: the decision, why it looked, what it saw, the options it
 * weighed, the limits check, the cost, what happened, if you were asked, the proof, how it looks now.
 */
export default async function DecisionPage({ params }: { params: Promise<{ slug: string; seq: string }> }) {
  const { slug, seq } = await params
  const resolved = await deskForViewer(slug)
  if (!resolved) notFound()
  const { face: desk, isOwner } = resolved
  const full = await decisionInFull(db(), desk.id, Number(seq))
  if (!full) notFound()

  const { decision, actions, grade, approval } = full
  const Section = sectionCounter()
  // One view over every record version, so an older record renders in full rather than half blank.
  const body = viewRecord(decision.record)
  const now = new Date()
  const vaultMove = body?.candidate?.side === 'sweep' || body?.candidate?.side === 'redeem'
  const proof = await proofFor(desk.id, decision, actions)
  const who = recordPagesCopy.who(isOwner)
  const whose = isOwner ? 'Your' : 'The owner’s'
  const confirmed = actions.find((a) => a.status === 'confirmed')
  const feeWei =
    confirmed?.gasUsed !== null && confirmed?.gasUsed !== undefined && confirmed.effectiveGasPrice
      ? BigInt(confirmed.gasUsed) * BigInt(confirmed.effectiveGasPrice)
      : null

  return (
    <div className="container desk-page">
      <header className="desk-hero">
        <Link href={`/desk/${slug}/record` as Route} className="type-caption text-accent hover:underline">
          {c.back}
        </Link>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h1 className="type-headline text-ink">
            {outcomeLabel(decision.outcome)}
            {body?.candidate ? (
              <span className="text-ink-secondary"> · {vaultMove ? c.vault : body.candidate.symbol}</span>
            ) : null}
          </h1>
          <span className="flex items-baseline gap-3 type-caption text-ink-muted">
            <span>
              #{decision.seq} · <When at={decision.decidedAt} />
            </span>
            <ShareDecisionButton card={decisionCard(desk, full, body)} />
          </span>
        </div>
        <p className="type-body text-ink-secondary">{decision.summary}</p>
        {!isOwner && <p className="type-caption text-ink-muted">{recordPagesCopy.visitor}</p>}
      </header>

      <Section title={c.sections.decision}>
        <dl className="decision-grid">
          <div>
            <dt>{c.what}</dt>
            <dd>
              <Outcome outcome={decision.outcome} shadow={decision.shadow} />
            </dd>
          </div>
          <div>
            <dt>{c.mode}</dt>
            <dd className="type-body text-ink">{recordPagesCopy.modes[decision.mode]}</dd>
          </div>
          <div>
            <dt>{c.howSure}</dt>
            <dd className="type-data text-ink">
              {decision.confidencePercent === null ? c.noModel : `${decision.confidencePercent}%`}
            </dd>
          </div>
        </dl>
        {body?.override ? (
          <p className="type-body text-blocked">{c.override(body.override.by, body.override.reason)}</p>
        ) : null}
        {body?.approvalOf ? (
          <p className="type-body text-ink-secondary">
            {c.approvalOf(
              who,
              body.approvalOf.decisionSeq,
              ago(new Date(body.approvalOf.answeredAt), now),
              c.asked.via[body.approvalOf.answeredVia] ?? body.approvalOf.answeredVia,
              signedPercent(-body.approvalOf.movedBps),
            )}
          </p>
        ) : null}
      </Section>

      <Section title={c.sections.why}>
        {body?.candidate && (body.need || vaultMove) ? (
          <p className="type-body text-ink">{body.candidate.why}</p>
        ) : (
          <p className="type-body text-ink-secondary">{c.routine}</p>
        )}
        {body?.need?.rule ? (
          <p className="type-caption text-ink-secondary">{c.ruleFired(body.need.rule.id)}</p>
        ) : null}
        {body?.deferral ? (
          <p className="type-caption text-ink-secondary">
            {c.deferral(body.deferral.decisionSeq)}{' '}
            {body.deferral.stillStanding ? c.deferralStanding : (body.deferral.endedBecause ?? '')}
          </p>
        ) : null}
      </Section>

      <Section title={c.sections.saw}>
        {body ? (
          <WhatItSaw body={body} now={now} vaultMove={vaultMove} whose={whose} />
        ) : (
          <p className="type-body text-ink-secondary">{c.unreadable}</p>
        )}
      </Section>

      <Section title={c.sections.options}>
        <Options body={body} vaultMove={vaultMove} summary={decision.summary ?? ''} />
      </Section>

      <Section title={c.sections.limits}>
        <LimitsCheck body={body} vaultMove={vaultMove} />
      </Section>

      {body?.preview?.amountIn ? (
        <Section title={c.sections.cost}>
          <CostShown body={body} vaultMove={vaultMove} />
        </Section>
      ) : null}

      <Section title={c.sections.happened}>
        {actions.length === 0 ? (
          <p className="type-body text-ink-secondary">{c.nothingSent}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {actions.map((a) => (
              <li key={a.leg} className="flex flex-col gap-1">
                <p className="type-body text-ink">
                  {a.kind}
                  <span className="text-ink-secondary"> · {a.status.replace(/_/g, ' ')}</span>
                </p>
                {a.actualOut !== null && a.expectedOut !== null ? (
                  <p className="type-data text-ink-secondary">
                    {c.received(a.actualOut.toString(), a.expectedOut.toString())}
                  </p>
                ) : null}
                {a.failureCode ? (
                  <p className="type-body text-blocked">
                    {a.failureCode}
                    {a.failureDetail ? `: ${a.failureDetail}` : ''}
                  </p>
                ) : null}
                {a.txHash ? (
                  <a
                    href={`${EXPLORER}/tx/${a.txHash}`}
                    className="type-caption text-accent hover:underline"
                    rel="noreferrer noopener"
                  >
                    {short(a.txHash, 12, 8)}
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {feeWei !== null ? (
          <p className="type-caption text-ink-muted">
            {c.networkFee(Number(formatEther(feeWei)).toFixed(7))}
          </p>
        ) : null}
      </Section>

      {approval || decision.outcome === 'asked' ? (
        <Section title={c.sections.asked}>
          {!approval ? (
            <p className="type-body text-ink-secondary">{c.asked.expired}</p>
          ) : approval.status === 'pending' ? (
            <p className="type-body text-ink">{c.asked.pending(until(approval.expiresAt, now))}</p>
          ) : approval.status === 'approved' || approval.status === 'rejected' ? (
            <>
              <p className="type-body text-ink">
                {(approval.status === 'approved' ? c.asked.approved : c.asked.rejected)(
                  who,
                  approval.answeredAt ? ago(approval.answeredAt, now) : '',
                  (approval.answeredVia && c.asked.via[approval.answeredVia]) ?? '',
                )}
              </p>
              {approval.status === 'approved' ? (
                <p className="type-caption text-ink-secondary">
                  {approval.executionSeq !== null ? (
                    <Link
                      href={`/desk/${slug}/decision/${approval.executionSeq}` as Route}
                      className="text-accent hover:underline"
                    >
                      {c.asked.executed(approval.executionSeq)}
                    </Link>
                  ) : (
                    c.asked.notExecuted
                  )}
                </p>
              ) : null}
            </>
          ) : approval.status === 'expired' ? (
            <p className="type-body text-ink-secondary">{c.asked.expired}</p>
          ) : (
            <p className="type-body text-ink-secondary">
              {c.asked.cancelled(approval.cancelledReason ?? '')}
            </p>
          )}
        </Section>
      ) : null}

      <Section title={c.sections.proof}>
        <p className="type-body text-ink-secondary">
          {proof.kind === 'own'
            ? c.proofOwn
            : proof.kind === 'later'
              ? c.proofLater(proof.sealingSeq)
              : proof.kind === 'unknown'
                ? c.proofUnknown
                : c.proofUnsealed}
        </p>
        <CheckIt
          record={decision.record}
          recordHash={decision.recordHash}
          desk={desk.address}
          proof={proof}
        />
      </Section>

      <Section title={c.sections.now}>
        {grade ? (
          <p className="type-body text-ink">
            {grade.verdict === 'no_real_difference'
              ? c.grade.same
              : grade.verdict === 'better'
                ? c.grade.better(percent(Math.abs(grade.differenceBps ?? 0), 2))
                : grade.verdict === 'worse'
                  ? c.grade.worse(percent(Math.abs(grade.differenceBps ?? 0), 2))
                  : c.grade.ungradable}
            {grade.replay ? <span className="text-ink-muted">{c.grade.replay}</span> : null}
          </p>
        ) : (
          <p className="type-body text-ink-secondary">{vaultMove ? c.grade.vault : c.grade.notYet}</p>
        )}
      </Section>
    </div>
  )
}

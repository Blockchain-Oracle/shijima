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
import {
  Eye,
  Fingerprint,
  Gavel,
  Hand,
  Hourglass,
  Link2,
  Receipt,
  Search,
  ShieldCheck,
  Split,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react'
import type { Route } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { formatEther } from 'viem'
import { CheckIt } from '@/components/check-it'
import { Outcome } from '@/components/outcome'
import { When } from '@/components/when'
import { DECISION_LOOK, DecisionHero } from '@/features/record/DecisionHero'
import { CostShown, LimitsCheck, Options, WhatItSaw } from '@/features/record/DecisionSaw'
import { DecisionStep } from '@/features/record/DecisionStep'
import { DriftBar } from '@/features/record/DriftBar'
import '@/features/record/decision.css'
import { decisionCard } from '@/features/share/card-data'
import { ShareDecisionButton } from '@/features/share/ShareDecisionButton'
import { db } from '@/lib/db'
import { deskForViewer } from '@/lib/desk.server'
import { proofFor } from '@/lib/proof.server'

export const dynamic = 'force-dynamic'

/** Sections number themselves in the order they appear, so a page with nothing to ask reads with no gap. */
function sectionCounter() {
  let n = 0
  return function Section({
    title,
    icon,
    tone,
    children,
  }: {
    title: string
    icon: React.ReactNode
    tone?: string
    children: React.ReactNode
  }) {
    n += 1
    return (
      <DecisionStep n={n} title={title} icon={icon} {...(tone ? { tone } : {})}>
        {children}
      </DecisionStep>
    )
  }
}

/**
 * One decision, in full [8.11], in the brief's order: the decision, why it looked, what it saw, the options it
 * weighed, the limits check, the cost, what happened, if you were asked, the proof, how it looks now.
 */
export async function generateMetadata({ params }: { params: Promise<{ slug: string; seq: string }> }) {
  const { seq } = await params
  return { title: `Decision #${seq}` }
}

export default async function DecisionPage({ params }: { params: Promise<{ slug: string; seq: string }> }) {
  const { slug, seq } = await params
  const sequence = Number(seq)
  if (!Number.isSafeInteger(sequence) || sequence < 1) notFound()
  const resolved = await deskForViewer(slug)
  if (!resolved) notFound()
  const { face: desk, isOwner } = resolved
  const full = await decisionInFull(db(), desk.id, sequence)
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

  const tone = DECISION_LOOK[decision.outcome].tone
  const onChainTx = proof.kind === 'unsealed' ? null : proof.txHash

  return (
    <div className="container desk-page dc-page">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <Link href={`/agents/${slug}/record` as Route} className="type-caption text-accent hover:underline">
          {c.back}
        </Link>
        <ShareDecisionButton card={decisionCard(desk, full, body)} />
      </header>
      {!isOwner && <p className="type-caption text-ink-muted">{recordPagesCopy.visitor}</p>}

      <DecisionHero decision={decision} body={body} />

      <ol className="dc-steps" aria-label={c.sections.decision}>
        <Section title={c.sections.decision} icon={<Gavel />} tone={tone}>
          <dl className="dc-facts">
            <div className="dc-fact">
              <dt>{c.what}</dt>
              <dd>
                <Outcome outcome={decision.outcome} shadow={decision.shadow} />
              </dd>
            </div>
            <div className="dc-fact">
              <dt>{c.mode}</dt>
              <dd>{recordPagesCopy.modes[decision.mode]}</dd>
            </div>
            <div className="dc-fact">
              <dt>{c.howSure}</dt>
              <dd>{decision.confidencePercent === null ? c.noModel : `${decision.confidencePercent}%`}</dd>
            </div>
            <div className="dc-fact">
              <dt>{c.when}</dt>
              <dd>
                <When at={decision.decidedAt} />
              </dd>
            </div>
          </dl>
          {body?.override ? (
            <p className="dc-blocker">{c.override(body.override.by, body.override.reason)}</p>
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

        <Section title={c.sections.why} icon={<Search />}>
          {body?.candidate && (body.need || vaultMove) ? (
            <p className="dc-lead">{body.candidate.why}</p>
          ) : (
            <p className="type-body text-ink-secondary">{c.routine}</p>
          )}
          {body?.position && !vaultMove ? (
            <DriftBar
              weightBps={body.position.weightBps}
              targetBps={body.position.targetBps}
              thresholdBps={body.position.thresholdBps}
            />
          ) : null}
          {body?.need?.rule ? <p className="dc-chip-line">{c.ruleFired(body.need.rule.id)}</p> : null}
          {body?.deferral ? (
            <p className="type-caption text-ink-secondary">
              {c.deferral(body.deferral.decisionSeq)}{' '}
              {body.deferral.stillStanding ? c.deferralStanding : (body.deferral.endedBecause ?? '')}
            </p>
          ) : null}
        </Section>

        <Section title={c.sections.saw} icon={<Eye />}>
          {body ? (
            <WhatItSaw body={body} now={now} vaultMove={vaultMove} whose={whose} />
          ) : (
            <p className="type-body text-ink-secondary">{c.unreadable}</p>
          )}
        </Section>

        <Section title={c.sections.options} icon={<Split />}>
          <Options body={body} vaultMove={vaultMove} summary={decision.summary ?? ''} />
        </Section>

        <Section title={c.sections.limits} icon={<ShieldCheck />}>
          <LimitsCheck body={body} vaultMove={vaultMove} />
        </Section>

        {body?.preview?.amountIn ? (
          <Section title={c.sections.cost} icon={<Receipt />}>
            <CostShown body={body} vaultMove={vaultMove} />
          </Section>
        ) : null}

        <Section title={c.sections.happened} icon={<Zap />}>
          {actions.length === 0 ? (
            <p className="type-body text-ink-secondary">{c.nothingSent}</p>
          ) : (
            <ul className="dc-actions">
              {actions.map((a) => (
                <li key={a.leg} className="dc-action">
                  <span className="dc-action-head">
                    <b>{a.kind}</b>
                    <span
                      className="dc-badge"
                      data-tone={a.status === 'confirmed' ? 'ok' : a.failureCode ? 'bad' : undefined}
                    >
                      {a.status.replace(/_/g, ' ')}
                    </span>
                  </span>
                  {a.actualOut !== null && a.expectedOut !== null ? (
                    <span className="type-data text-ink-secondary">
                      {c.received(a.actualOut.toString(), a.expectedOut.toString())}
                    </span>
                  ) : null}
                  {a.failureCode ? (
                    <span className="text-blocked">
                      {a.failureCode}
                      {a.failureDetail ? `: ${a.failureDetail}` : ''}
                    </span>
                  ) : null}
                  {a.txHash ? (
                    <a
                      href={`${EXPLORER}/tx/${a.txHash}`}
                      className="dc-explorer text-accent hover:underline"
                      rel="noreferrer noopener"
                      target="_blank"
                    >
                      {short(a.txHash, 12, 8)} ↗
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
          <Section title={c.sections.asked} icon={<Hand />}>
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
                        href={`/agents/${slug}/decision/${approval.executionSeq}` as Route}
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

        <Section title={c.sections.proof} icon={<Fingerprint />}>
          <ol className="dc-proof-rail">
            <li data-done="">
              <b>
                <Receipt aria-hidden />
                {c.proofSteps.written}
              </b>
              <span>
                #{decision.seq} · <When at={decision.decidedAt} />
              </span>
            </li>
            <li data-done="">
              <b>
                <Fingerprint aria-hidden />
                {c.proofSteps.fingerprinted}
              </b>
              <code>{short(decision.recordHash, 10, 6)}</code>
            </li>
            <li data-done={onChainTx ? '' : undefined}>
              <b>
                <Link2 aria-hidden />
                {onChainTx ? c.proofSteps.onChain : c.proofSteps.waiting}
              </b>
              {onChainTx ? (
                <a
                  href={`${EXPLORER}/tx/${onChainTx}`}
                  className="text-accent hover:underline"
                  rel="noreferrer noopener"
                  target="_blank"
                >
                  {short(onChainTx, 10, 6)} ↗
                </a>
              ) : null}
            </li>
          </ol>
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

        <Section title={c.sections.now} icon={<Hourglass />}>
          {grade ? (
            <p className="dc-grade" data-verdict={grade.verdict}>
              {grade.verdict === 'better' ? (
                <TrendingUp aria-hidden />
              ) : grade.verdict === 'worse' ? (
                <TrendingDown aria-hidden />
              ) : (
                <Hourglass aria-hidden />
              )}
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
      </ol>
    </div>
  )
}

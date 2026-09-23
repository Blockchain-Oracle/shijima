import { EXPLORER } from '@desk/chain'
import type { DecisionInFull, PublicDesk } from '@desk/db'
import { appCopy, decisionCopy, type RecordView, short } from '@desk/shared'
import { ArrowUpRight, Check, CircleDashed, ExternalLink, X } from 'lucide-react'
import type { Route } from 'next'
import Link from 'next/link'
import { Outcome } from '@/components/outcome'
import { TokenLogo } from '@/components/ui/token-logo'
import { When } from '@/components/when'
import { decisionCard } from '@/features/share/card-data'
import { ShareDecisionButton } from '@/features/share/ShareDecisionButton'

const c = appCopy.agentPage.decision

/**
 * The agent's latest real decision, first on its page: what it chose, in one line with the token's face, why,
 * how sure it was, what it turned down, and the proof: the transaction on the explorer, or "practice, nothing
 * sent". Share and the full record are one tap away.
 */
export function LatestDecision({
  slug,
  desk,
  full,
  body,
}: {
  slug: string
  desk: PublicDesk
  full: DecisionInFull | undefined
  body: RecordView | undefined
}) {
  if (!full) {
    return (
      <section className="ap-card ap-decision" aria-label={c.title}>
        <p className="ap-label">{c.title}</p>
        <p className="ap-decision-empty">{c.none}</p>
      </section>
    )
  }
  const { decision, actions } = full
  const cand = body?.candidate ?? null
  const model = body?.serv?.decision ?? null
  const reasons = model?.reasons.slice(0, 2).map((r) => r.text) ?? []
  const why = cand?.why || reasons[0] || decision.summary
  // A trade's own transaction, when it traded; otherwise the checkpoint that fingerprinted this record on chain.
  const trades = actions.filter((a) => a.kind !== 'checkpoint')
  const confirmed = trades.find((a) => a.status === 'confirmed' && a.txHash)
  const sent = trades.find((a) => a.txHash)
  const sealed = actions.find((a) => a.kind === 'checkpoint' && a.status === 'confirmed' && a.txHash)
  // Records write the amount in dollars ("1.735893", unit USDG); a sell names its token amount instead.
  const amount =
    cand?.amountIn && cand.amountInUnit.toUpperCase() === 'USDG' && Number(cand.amountIn) > 0
      ? `$${Number(cand.amountIn).toFixed(2)}`
      : null
  const action =
    cand && cand.side !== 'sweep' && cand.side !== 'redeem'
      ? c.action(cand.side, amount, cand.symbol)
      : decision.summary
  const confidence = decision.confidencePercent

  return (
    <section className="ap-card ap-decision" aria-label={c.title}>
      <header className="ap-decision-head">
        <p className="ap-label">{c.title}</p>
        <span className="ap-decision-when">
          <When at={decision.decidedAt} />
        </span>
      </header>

      <div className="ap-decision-main">
        {cand?.symbol ? <TokenLogo symbol={cand.symbol} size={44} /> : <TokenLogo symbol="CASH" size={44} />}
        <div className="ap-decision-what">
          <Outcome outcome={decision.outcome} shadow={decision.shadow} />
          <p className="ap-decision-action">{action}</p>
        </div>
      </div>

      <p className="ap-decision-why">{why}</p>

      <div className="ap-decision-facts">
        {confidence !== null && (
          <div className="ap-confidence" title={c.sureTitle}>
            <span className="ap-confidence-label">{c.sure(confidence)}</span>
            <span className="ap-confidence-bar" aria-hidden="true">
              <span style={{ width: `${Math.max(4, Math.min(100, confidence))}%` }} />
            </span>
          </div>
        )}
        {model && (
          <ul className="ap-options" aria-label={c.options}>
            <li className="is-chosen">
              <Check aria-hidden="true" className="size-3" />
              {decisionCopy.options[model.option] ?? model.option}
            </li>
            {model.rejected.map((r) => (
              <li key={r.option} title={r.reason}>
                <X aria-hidden="true" className="size-3" />
                {decisionCopy.options[r.option] ?? r.option}
              </li>
            ))}
          </ul>
        )}
      </div>

      <footer className="ap-decision-foot">
        {confirmed?.txHash ? (
          <a
            className="ap-proof is-onchain"
            href={`${EXPLORER}/tx/${confirmed.txHash}`}
            target="_blank"
            rel="noreferrer noopener"
          >
            <ExternalLink aria-hidden="true" className="size-3.5" />
            {c.tx(short(confirmed.txHash, 8, 6))}
          </a>
        ) : sent?.txHash ? (
          <a
            className="ap-proof"
            href={`${EXPLORER}/tx/${sent.txHash}`}
            target="_blank"
            rel="noreferrer noopener"
          >
            <ExternalLink aria-hidden="true" className="size-3.5" />
            {c.sentNotConfirmed(short(sent.txHash, 8, 6))}
          </a>
        ) : (
          <span className="ap-proof-group">
            <span className="ap-proof">
              <CircleDashed aria-hidden="true" className="size-3.5" />
              {decision.shadow ? c.practice : c.nothingSent}
            </span>
            {sealed?.txHash && (
              <a
                className="ap-proof is-sealed"
                href={`${EXPLORER}/tx/${sealed.txHash}`}
                target="_blank"
                rel="noreferrer noopener"
              >
                <ExternalLink aria-hidden="true" className="size-3.5" />
                {c.sealed(short(sealed.txHash, 8, 6))}
              </a>
            )}
          </span>
        )}
        <span className="ap-decision-links">
          <ShareDecisionButton card={decisionCard(desk, full, body)} />
          <Link href={`/agents/${slug}/decision/${decision.seq}` as Route} className="ap-open">
            {c.open} <ArrowUpRight aria-hidden="true" className="size-3.5" />
          </Link>
        </span>
      </footer>
    </section>
  )
}

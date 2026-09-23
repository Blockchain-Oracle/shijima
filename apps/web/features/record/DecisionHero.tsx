import { tokenByAddress } from '@desk/chain'
import type { PublicDecision } from '@desk/db'
import { decisionCopy as c, money, type RecordView } from '@desk/shared'
import { Ban, Check, Eye, Hand, Hourglass, type LucideIcon, Moon, PiggyBank, ShieldAlert } from 'lucide-react'
import { outcomeLabel } from '@/components/outcome'
import { RadialGauge, StatusDot } from '@/components/ui/desk-kit'
import { TokenLogo } from '@/components/ui/token-logo'
import { When } from '@/components/when'

type Outcome = PublicDecision['outcome']
export type DecisionTone = 'acted' | 'practice' | 'waited' | 'asked' | 'quiet' | 'error'

/** One tone and one icon per outcome, so the hero, the stepper and the record never disagree about a colour. */
export const DECISION_LOOK: Record<Outcome, { tone: DecisionTone; icon: LucideIcon }> = {
  acted: { tone: 'acted', icon: Check },
  acted_in_part: { tone: 'acted', icon: Check },
  acted_by_override: { tone: 'acted', icon: Check },
  would_have_acted: { tone: 'practice', icon: Eye },
  waited: { tone: 'waited', icon: Hourglass },
  asked: { tone: 'asked', icon: Hand },
  declined: { tone: 'quiet', icon: Ban },
  nothing_to_do: { tone: 'quiet', icon: Moon },
  blocked_by_limit: { tone: 'error', icon: ShieldAlert },
  failed: { tone: 'error', icon: ShieldAlert },
  not_executed: { tone: 'error', icon: ShieldAlert },
}

const tokenAmount = (decimal: string) => {
  const n = Number(decimal)
  return n >= 1 ? n.toFixed(2) : n.toPrecision(3)
}

/** "Buy $1.74 of Nvidia", "Sell 0.0025 of Nvidia", "Park $140.00 in the savings vault", or null. */
function actionLine(body: RecordView | undefined): string | null {
  const cand = body?.candidate
  if (!cand) return null
  const name = tokenByAddress(cand.token)?.displayName ?? cand.symbol
  if (cand.side === 'buy') return c.hero.buy(money(cand.amountIn), name)
  if (cand.side === 'sell') return c.hero.sell(tokenAmount(cand.amountIn), name)
  if (cand.side === 'sweep') return c.hero.sweep(money(cand.amountIn))
  return c.hero.redeem
}

/**
 * The decision at a glance, after Agari's S22 `DecisionHero`: the verdict in its colour with its icon, the stock it
 * was about, what it would do in words, the one-line reason, and how sure the AI was as a ring. A check that asked
 * no AI says so in the ring instead of showing a number that was never produced.
 */
export function DecisionHero({
  decision,
  body,
}: {
  decision: Pick<PublicDecision, 'outcome' | 'seq' | 'decidedAt' | 'summary' | 'shadow' | 'confidencePercent'>
  body: RecordView | undefined
}) {
  const look = DECISION_LOOK[decision.outcome]
  const Icon = look.icon
  const cand = body?.candidate
  const vault = cand?.side === 'sweep' || cand?.side === 'redeem'
  const line = actionLine(body)
  const confidence = decision.confidencePercent
  return (
    <section className="dc-hero" data-tone={look.tone} aria-label={outcomeLabel(decision.outcome)}>
      <div className="dc-hero-glow" aria-hidden />
      <div className="dc-hero-main">
        <div className="dc-hero-top">
          <span className="dc-verdict-icon" aria-hidden>
            <Icon />
          </span>
          <span className="dc-verdict">{outcomeLabel(decision.outcome)}</span>
          <StatusDot tone={decision.shadow ? 'practice' : 'live'}>
            {decision.shadow ? c.hero.practice : c.hero.live}
          </StatusDot>
        </div>
        <div className="dc-hero-subject">
          {cand ? (
            vault ? (
              <span className="dc-hero-vault" aria-hidden>
                <PiggyBank />
              </span>
            ) : (
              <TokenLogo symbol={cand.symbol} size={48} />
            )
          ) : null}
          <h1 className="dc-hero-title">{line ?? outcomeLabel(decision.outcome)}</h1>
        </div>
        <p className="dc-hero-summary">{decision.summary}</p>
        <p className="dc-hero-meta">
          <span>{c.hero.seq(decision.seq)}</span>
          <span aria-hidden>·</span>
          <When at={decision.decidedAt} />
        </p>
      </div>
      <div className="dc-hero-side-col">
        <RadialGauge
          value={confidence ?? 0}
          size={96}
          stroke={8}
          tone={look.tone === 'acted' ? 'profit' : look.tone === 'error' ? 'loss' : 'accent'}
          label={confidence === null ? c.noModel : `${confidence}% ${c.hero.sure}`}
        >
          <span className="dc-gauge-text">
            <b>{confidence === null ? '—' : `${confidence}%`}</b>
            <small>{confidence === null ? c.hero.noModel : c.hero.sure}</small>
          </span>
        </RadialGauge>
      </div>
    </section>
  )
}

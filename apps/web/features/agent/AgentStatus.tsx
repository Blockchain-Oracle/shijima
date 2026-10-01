import { appCopy, marketClock, percent, until, webCopy } from '@desk/shared'
import { TokenLogo, TokenStack } from '@/components/ui/token-logo'
import type { DeskView } from '@/lib/desk.server'
import { StatusClock } from './StatusClock'
import { dollars, stuckOf } from './TooSmallToTrade'

const s = appCopy.agentPage.status

type Tone = 'live' | 'idle' | 'warn' | 'off'

/** What the agent is doing, as one headline and one plain sentence, from the first thing that holds. */
function stateOf(view: DeskView): { tone: Tone; title: string; body: string; symbols: string[] } {
  const d = view.desk
  const basket = view.mandate?.targets.map((t) => t.symbol) ?? []
  const one = (tone: Tone, t: { title: string; body: string }, symbols = basket) => ({ tone, ...t, symbols })
  if (d.lifecycle === 'closed' || d.lifecycle === 'closing') return one('off', s.closed)
  if (d.lifecycle === 'onboarding') return one('idle', s.onboarding)
  if (d.state === 'paused_by_owner') return one('off', s.paused(view.isOwner))
  if (d.state === 'stopped_by_loss_limit') return one('warn', s.stopped)
  if (d.state === 'needs_attention') return one('warn', s.attention)
  if (!view.plate || BigInt(view.plate.totalUsdg) === 0n) return one('idle', s.noMoney)
  if (
    view.qualification &&
    view.qualification.eligibleSymbols.length === 0 &&
    view.qualification.excluded.length > 0
  )
    return one(
      'warn',
      { title: s.notQualified.title, body: view.qualification.summary },
      view.qualification.excluded.map((e) => e.symbol),
    )
  const stuck = stuckOf(view)
  if (stuck) return one('warn', s.tooSmall(dollars(stuck.cash)))
  const wait = view.agent.waits[0]
  if (wait)
    return one('live', s.waiting(wait.side, wait.name, until(new Date(wait.revisitAt))), [wait.symbol])
  const drift = view.mandate?.driftToleranceBps ?? 300
  const off = [...view.holdings]
    .sort((a, b) => Math.abs(b.weightBps - b.targetBps) - Math.abs(a.weightBps - a.targetBps))
    .find((h) => Math.abs(h.weightBps - h.targetBps) >= drift)
  if (off) return one('live', s.due(off.name), [off.symbol])
  return one('live', s.watching(basket.length, percent(drift, 0), d.mode === 'shadow'))
}

/**
 * "Right now": what the agent is doing this minute, so a new owner with $1 never has to guess. After 21st's Agent
 * Progress (29323): the pulsing nine-dot glyph while it runs, a still one when it does not, beside the headline;
 * then the last look, a ring counting down to the next, and the US market's session, in bordered cells like the
 * Plan tab's limits.
 */
export function AgentStatus({ view }: { view: DeskView }) {
  const st = stateOf(view)
  const running = view.desk.lifecycle === 'running' && view.desk.state === 'active'
  const session = marketClock().session
  return (
    <section className="ap-now" data-tone={st.tone} aria-label={s.title}>
      <div className="ap-now-main">
        <span className="ap-now-glyph" aria-hidden="true">
          {Array.from({ length: 9 }, (_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: nine fixed cells, never reordered
            <i key={i} style={{ animationDelay: `${i * 0.14}s` }} />
          ))}
        </span>
        <div className="ap-now-text">
          <span className="ap-now-kicker">{s.title}</span>
          <p className="ap-now-title" role="status">
            {st.symbols.length === 1 && st.symbols[0] ? (
              <TokenLogo symbol={st.symbols[0]} size={20} />
            ) : st.symbols.length > 1 ? (
              <TokenStack symbols={st.symbols} size={20} max={4} />
            ) : null}
            {st.title}
          </p>
          <p className="ap-now-body">{st.body}</p>
          <p className="ap-now-body">{s.checks(view.checksCompleted ?? 0)}</p>
        </div>
      </div>
      <dl className="ap-now-facts">
        <StatusClock lastCheckAt={view.desk.lastCheckAt} running={running} />
        <div>
          <dt>{s.market}</dt>
          <dd>
            <span className="ap-now-session" data-session={session} aria-hidden="true" />
            {webCopy.session.words[session]}
          </dd>
        </div>
      </dl>
    </section>
  )
}

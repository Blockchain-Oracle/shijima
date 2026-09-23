import { deskCopy, money } from '@desk/shared'
import { ArrowUpRight, Send } from 'lucide-react'
import type { Route } from 'next'
import Link from 'next/link'
import { outcomeLabel } from '@/components/outcome'
import { ShijimaMark } from '@/components/shell/ShijimaMark'
import { StatusDot } from '@/components/ui/desk-kit'
import { When } from '@/components/when'
import type { DeskView } from '@/lib/desk.server'
import './agent.css'

const A = deskCopy.agent

/** One sentence for what the agent is doing this minute, from the desk's state, its requests and its waits. */
function doingNow(view: DeskView): string {
  const d = view.desk
  if (d.lifecycle === 'closed') return A.status.closed
  if (d.assistantRemoved) return A.status.removed
  if (d.state === 'paused_by_owner') return A.status.paused
  if (d.state === 'stopped_by_loss_limit') return A.status.stopped
  if (d.state === 'needs_attention') return A.status.attention
  if (view.approvals.length > 0) return A.status.asking(view.approvals.length)
  const wait = view.agent.waits[0]
  if (wait) {
    const what =
      wait.side === 'buy' && wait.amountUsdg ? A.buy(money(wait.amountUsdg), wait.name) : A.sell(wait.name)
    return wait.wouldHave ? A.status.wouldHave(what) : A.status.waiting(what, A.afterReopen)
  }
  if (!d.lastCheckAt) return A.status.notStarted
  return A.status.watching(view.holdings.filter((h) => h.targetBps > 0).length)
}

/**
 * The AI agent, present on its own desk: its face, what it is doing right now in one sentence, when it last
 * looked and looks next, how many decisions it has made, its latest real one, and whether it can reach the owner
 * on Telegram. The desk is the account; this card is who works it.
 */
export function AgentCard({ view }: { view: DeskView }) {
  const d = view.desk
  const live = d.mode !== 'shadow'
  const resting = d.state !== 'active' || d.lifecycle !== 'running'
  const tone = resting ? 'warn' : live ? 'live' : 'practice'
  const latest = view.agent.latest
  return (
    <section className="ag-card" data-resting={resting ? '' : undefined} aria-label={A.role}>
      <div className="ag-head">
        <span className="ag-avatar" aria-hidden>
          <span className="ag-avatar-pulse" />
          <ShijimaMark />
        </span>
        <div className="ag-id">
          <span className="ag-role">{view.isOwner ? A.role : A.roleVisitor}</span>
          <span className="ag-name">
            {A.name} <span lang="ja">しじま</span>
          </span>
        </div>
        <StatusDot tone={tone}>{deskCopy.modes[d.mode]}</StatusDot>
      </div>

      <div className="ag-now">
        <span className="ag-label">{A.doing}</span>
        <p className="ag-now-text">{doingNow(view)}</p>
      </div>

      <dl className="ag-stats">
        <div>
          <dt>{A.lastCheck}</dt>
          <dd>{d.lastCheckAt ? <When at={d.lastCheckAt} /> : '—'}</dd>
        </div>
        <div>
          <dt>{A.nextCheck}</dt>
          <dd>{resting ? '—' : <When at={d.nextCheckAt} clock />}</dd>
        </div>
        <div>
          <dt>{A.decisions}</dt>
          <dd>{view.agent.total}</dd>
        </div>
        <div>
          <dt>{live ? A.acted : outcomeLabel('would_have_acted')}</dt>
          <dd>{view.agent.acted}</dd>
        </div>
      </dl>

      {latest ? (
        <Link href={`/desk/${view.slug}/decision/${latest.seq}` as Route} className="ag-latest">
          <span className="ag-label">
            {A.latest} · {outcomeLabel(latest.outcome as Parameters<typeof outcomeLabel>[0])}
          </span>
          <span className="ag-latest-text">{latest.summary}</span>
          <ArrowUpRight className="ag-latest-go" aria-hidden />
        </Link>
      ) : null}

      <p className="ag-foot">
        <span>{live ? A.liveNote : A.practiceNote}</span>
        {view.isOwner && d.telegramLinked !== null ? (
          <span className="ag-tg" data-on={d.telegramLinked ? '' : undefined}>
            <Send aria-hidden />
            {d.telegramLinked ? A.telegramOn : A.telegramOff}
          </span>
        ) : null}
      </p>
    </section>
  )
}

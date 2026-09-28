import { decisionInFull, gradeTally, leaderOf } from '@desk/db'
import { appCopy, deskCopy, engineCopy, short, viewRecord } from '@desk/shared'
import { Settings } from 'lucide-react'
import type { Route } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { LiveBadge } from '@/components/shell/app/LiveBadge'
import { TokenStack } from '@/components/ui/token-logo'
import { AgentActivity } from '@/features/agent/AgentActivity'
import { AgentMoney } from '@/features/agent/AgentMoney'
import { LatestDecision } from '@/features/agent/LatestDecision'
import { Portfolio } from '@/features/agent/Portfolio'
import { TooSmallToTrade } from '@/features/agent/TooSmallToTrade'
import { CopyButton } from '@/features/copy/CopyButton'
import { CopyingBar } from '@/features/copy/CopyingBar'
import { DeskChat } from '@/features/desk/DeskChat'
import { QuickActions } from '@/features/desk/DeskControls'
import { Limits, NeedsYou, Record } from '@/features/desk/DeskPanels'
import { DeskSessionProvider } from '@/features/session/DeskSessionProvider'
import { controlsOf } from '@/lib/controls'
import { db } from '@/lib/db'
import { deskForViewer, loadDesk } from '@/lib/desk.server'
import { signedInAddress } from '@/lib/session'
import '@/features/agent/agent-page.css'
import '@/features/desk/agent.css'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const view = await loadDesk((await params).slug)
  return { title: view?.desk.name ?? 'Agent' }
}

/**
 * One agent, decision first. The header says whose it is and how it runs; under it the agent's account address
 * (where money is sent, DECISIONS F3) and the owner's money buttons. Then two columns: on the left what it decided
 * last, anything waiting on the owner, and everything it has done (and, for the owner, the chat); on the right
 * one portfolio module and its limits. On a phone the same blocks stack in reading order: decision, portfolio,
 * activity.
 */
export default async function AgentPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ ask?: string; copy?: string }>
}) {
  const { slug } = await params
  const [view, resolved] = await Promise.all([loadDesk(slug), deskForViewer(slug)])
  const { ask, copy } = await searchParams
  if (!view || !resolved) notFound()
  const d = view.desk
  const c = appCopy.agentPage
  const latestSeq = view.agent.latest?.seq
  const full = latestSeq !== undefined ? await decisionInFull(db(), d.id, latestSeq) : undefined
  const body = full ? viewRecord(full.decision.record) : undefined
  const symbols = view.mandate?.targets.map((t) => t.symbol) ?? []
  const [leader, tally] = await Promise.all([leaderOf(db(), d.id), gradeTally(db(), d.id)])
  const signedIn = (await signedInAddress().catch(() => undefined)) !== undefined

  return (
    <div className="app-container ap-page">
      <header className="ap-head">
        <div className="ap-id">
          {symbols.length > 0 ? <TokenStack symbols={symbols} size={40} max={4} /> : null}
          <div className="ap-id-text">
            <h1 className="ap-name">{d.name}</h1>
            <p className="ap-sub">
              {view.mandate?.preset ?? deskCopy.ownBasket}
              {' · '}
              {view.isOwner ? c.yours : c.by(short(view.owner, 6, 4))}
              {' · '}
              <span className="ap-record" title={appCopy.agents.recordTitle}>
                {c.record(tally.better, tally.graded)}
              </span>
            </p>
          </div>
          <span className="desk-badge" data-mode={d.mode}>
            {deskCopy.modes[d.mode]}
          </span>
          {d.state !== 'active' && (
            <span className="desk-badge" data-state={d.state}>
              {engineCopy.deskState[d.state]}
            </span>
          )}
        </div>
        <div className="ap-head-side">
          <LiveBadge compact />
          {!view.isOwner && d.lifecycle !== 'closed' && (
            <CopyButton leaderSlug={view.slug} signedIn={signedIn} autoOpen={copy === '1'} />
          )}
          {view.isOwner && (
            <Link href={`/agents/${view.slug}/settings` as Route} className="ap-gear" aria-label={c.settings}>
              <Settings aria-hidden="true" className="size-4" />
            </Link>
          )}
        </div>
      </header>

      <DeskSessionProvider
        owner={view.owner}
        desk={d.address as `0x${string}`}
        contractVersion={d.contractVersion}
      >
        <AgentMoney address={d.address} balances={view.plate} />
        <TooSmallToTrade view={view} />
        {view.isOwner && (
          <div className="ap-actions">
            <QuickActions view={controlsOf(view)} />
          </div>
        )}
        {leader && (
          <CopyingBar
            deskId={d.id}
            owner={view.isOwner}
            leader={{
              name: leader.name ?? 'Agent',
              slug: leader.shareSlug ?? leader.link.leaderDeskId,
              status: leader.link.status,
            }}
          />
        )}
        {!view.isOwner && <p className="ap-visitor">{deskCopy.visitor}</p>}

        <div className="ap-grid">
          <div className="ap-col ap-col--main">
            {view.isOwner && (view.approvals.length > 0 || d.stateReason) ? (
              <div className="ap-o-needs">
                <NeedsYou view={view} />
              </div>
            ) : null}
            <div className="ap-o-decision">
              <LatestDecision slug={view.slug} desk={resolved.face} full={full} body={body} />
            </div>
            <div className="ap-o-activity">
              <AgentActivity
                record={<Record view={view} limit={12} />}
                chat={
                  view.isOwner ? (
                    <DeskChat deskId={d.id} slug={view.slug} initial={view.turns} prefill={ask} />
                  ) : null
                }
              />
            </div>
          </div>
          <div className="ap-col ap-col--side">
            <div className="ap-o-portfolio">
              <Portfolio view={view} />
            </div>
            <div className="ap-o-limits">
              <Limits view={view} />
            </div>
          </div>
        </div>
      </DeskSessionProvider>
    </div>
  )
}

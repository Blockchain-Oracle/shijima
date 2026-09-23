import { APPROVED_TOKENS } from '@desk/chain'
import { deskCopy, engineCopy, PRESETS } from '@desk/shared'
import { notFound } from 'next/navigation'
import { TokenStack } from '@/components/ui/token-logo'
import { AgentCard } from '@/features/desk/AgentCard'
import { DeskChat } from '@/features/desk/DeskChat'
import { type ControlsView, DeskControls, QuickActions } from '@/features/desk/DeskControls'
import {
  Allocation,
  Holdings,
  Limits,
  Mandate,
  NeedsYou,
  NextCheck,
  Plate,
  Record,
  ValueChart,
} from '@/features/desk/DeskPanels'
import { DeskSections } from '@/features/desk/DeskSections'
import { DeskTabs } from '@/features/desk/DeskTabs'
import { DeskSessionProvider } from '@/features/session/DeskSessionProvider'
import { OwnerSessionPanel } from '@/features/session/OwnerSessionPanel'
import { loadDesk } from '@/lib/desk.server'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const view = await loadDesk((await params).slug)
  return { title: view?.desk.name ?? 'A desk' }
}

/**
 * One desk. Its owner lands here, and the chat comes first: you talk to your desk and it gets things done. A
 * visitor with the share link sees the same page read-only, without the chat.
 */
export default async function DeskPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ ask?: string }>
}) {
  const view = await loadDesk((await params).slug)
  const { ask } = await searchParams
  if (!view) notFound()
  const d = view.desk
  const controls: ControlsView = {
    deskId: d.id,
    slug: view.slug,
    address: d.address,
    owner: view.owner,
    mode: d.mode,
    state: d.state,
    lifecycle: d.lifecycle,
    assistantRemoved: d.assistantRemoved,
    shadowChecks: d.shadowChecks,
    goLiveChecks: d.goLiveChecks,
    reportOpened: d.reportOpened,
    cashUsdg: view.plate?.cashUsdg ?? null,
    perActionCapUsdg: view.mandate?.perActionCapUsdg ?? null,
    dailyCapUsdg: view.mandate?.dailyCapUsdg ?? null,
    mandate: view.mandate
      ? {
          presetId: view.mandate.presetId,
          targets: view.mandate.targets,
          cashBps: view.mandate.cashTargetBps,
          driftToleranceBps: view.mandate.driftToleranceBps,
          maxPositionBps: view.mandate.maxPositionBps,
          lossStopBps: view.mandate.lossStopBps,
          notes: view.mandate.notes,
          rules: view.mandate.rules,
        }
      : null,
    tokens: APPROVED_TOKENS.map((t) => ({ symbol: t.symbol, name: t.displayName })),
    presets: PRESETS.map((p) => ({ id: p.id, name: p.name })),
  }
  return (
    <div className="container desk-page">
      <header className="desk-hero">
        <div className="flex flex-wrap items-center gap-3">
          {view.mandate && view.mandate.targets.length > 0 ? (
            <TokenStack symbols={view.mandate.targets.map((t) => t.symbol)} size={34} max={4} />
          ) : null}
          <div className="flex min-w-0 flex-col">
            <h1 className="type-headline text-ink">{d.name}</h1>
            {view.mandate ? (
              <span className="type-caption text-ink-muted">
                {view.mandate.preset ?? deskCopy.ownBasket}
                {' · '}
                {view.mandate.targets.map((t) => t.symbol).join(', ')}
              </span>
            ) : null}
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
        {!view.isOwner && <p className="type-caption text-ink-muted">{deskCopy.visitor}</p>}
      </header>
      <DeskSessionProvider
        owner={view.owner}
        desk={d.address as `0x${string}`}
        contractVersion={d.contractVersion}
      >
        <DeskTabs
          agent={<AgentCard view={view} />}
          chat={
            view.isOwner ? (
              <DeskChat deskId={d.id} slug={view.slug} initial={view.turns} prefill={ask} />
            ) : null
          }
          desk={
            <>
              <NeedsYou view={view} />
              <Plate view={view} />
              {view.isOwner && <QuickActions view={controls} />}
              <ValueChart view={view} />
              <DeskSections
                count={view.agent.total}
                portfolio={
                  <>
                    <Allocation view={view} />
                    <Holdings view={view} />
                    <Limits view={view} />
                  </>
                }
                activity={<Record view={view} />}
                settings={
                  <>
                    {view.isOwner && <DeskControls view={controls} />}
                    <NextCheck view={view} />
                    <Mandate view={view} />
                    {view.isOwner && <OwnerSessionPanel />}
                  </>
                }
              />
            </>
          }
        />
      </DeskSessionProvider>
    </div>
  )
}

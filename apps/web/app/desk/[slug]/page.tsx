import { deskCopy, engineCopy } from '@desk/shared'
import { notFound } from 'next/navigation'
import { DeskChat } from '@/features/desk/DeskChat'
import {
  Holdings,
  Limits,
  Mandate,
  NeedsYou,
  NextCheck,
  Plate,
  Record,
  ValueChart,
} from '@/features/desk/DeskPanels'
import { DeskTabs } from '@/features/desk/DeskTabs'
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
export default async function DeskPage({ params }: { params: Promise<{ slug: string }> }) {
  const view = await loadDesk((await params).slug)
  if (!view) notFound()
  const d = view.desk
  return (
    <div className="container desk-page">
      <header className="desk-hero">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="type-headline text-ink">{d.name}</h1>
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
      <DeskTabs
        chat={view.isOwner ? <DeskChat deskId={d.id} slug={view.slug} initial={view.turns} /> : null}
        desk={
          <>
            <NeedsYou view={view} />
            <Plate view={view} />
            <NextCheck view={view} />
            <Holdings view={view} />
            <ValueChart view={view} />
            <Limits view={view} />
            <Mandate view={view} />
          </>
        }
        record={<Record view={view} />}
      />
    </div>
  )
}

import {
  deskById,
  deskIdBySlug,
  disclosureAccepted,
  openservForDesk,
  ownerIdOf,
  telegramForDesk,
} from '@desk/db'
import { DISCLOSURE_VERSION, settingsCopy as s } from '@desk/shared'
import type { Route } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import ThemeToggle from '@/components/shell/ThemeToggle'
import { DeskControls } from '@/features/desk/DeskControls'
import { Mandate } from '@/features/desk/DeskPanels'
import { DeskSessionProvider } from '@/features/session/DeskSessionProvider'
import { OwnerSessionPanel } from '@/features/session/OwnerSessionPanel'
import { CloseDeskButton } from '@/features/settings/CloseDeskButton'
import { Connections } from '@/features/settings/Connections'
import { Disclosure } from '@/features/settings/Disclosure'
import { ShareToggle } from '@/features/settings/ShareToggle'
import { controlsOf } from '@/lib/controls'
import { db } from '@/lib/db'
import { loadDesk } from '@/lib/desk.server'
import { signedInAddress } from '@/lib/session'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Settings' }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function Section({ title, body, children }: { title: string; body?: string; children: React.ReactNode }) {
  return (
    <section className="desk-panel">
      <h2 className="type-label-micro text-ink-muted">{title}</h2>
      {body && <p className="type-caption text-ink-secondary">{body}</p>}
      {children}
    </section>
  )
}

/** Settings (design brief 8.18): connections (Telegram, wallet, agent), the share link, the disclosure, appearance, and closing the desk. */
export default async function SettingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const viewer = await signedInAddress().catch(() => undefined)
  const id = UUID.test(slug) ? slug : await deskIdBySlug(db(), slug)
  const desk = id ? await deskById(db(), id) : undefined
  // Only the owner has settings. Anyone else gets the same answer as for a desk that does not exist.
  if (!desk || !viewer || viewer.toLowerCase() !== desk.ownerAddress.toLowerCase()) notFound()

  const ownerId = await ownerIdOf(db(), viewer)
  const [view, telegram, accepted, openserv] = await Promise.all([
    loadDesk(slug),
    telegramForDesk(db(), desk.id),
    ownerId ? disclosureAccepted(db(), ownerId, DISCLOSURE_VERSION) : Promise.resolve(null),
    openservForDesk(db(), desk.id),
  ])

  return (
    <div className="container settings-page">
      <header className="desk-hero">
        <Link href={`/agents/${slug}` as Route} className="type-caption text-ink-secondary hover:text-ink">
          ← {s.back}
        </Link>
        <h1 className="type-headline text-ink">
          {s.title} · {desk.name ?? 'Your desk'}
        </h1>
      </header>
      <DeskSessionProvider
        owner={desk.ownerAddress}
        desk={desk.address as `0x${string}`}
        contractVersion={desk.contractVersion}
      >
        <div className="settings-grid">
          {view && desk.lifecycle !== 'closed' && (
            <Section title={s.controls.title} body={s.controls.body}>
              <DeskControls view={controlsOf(view)} />
            </Section>
          )}
          {view && <Mandate view={view} />}
          {view && desk.lifecycle !== 'closed' && <OwnerSessionPanel />}
          <Section title={s.connections.title} body={s.connections.body}>
            <Connections
              deskId={desk.id}
              ownerAddress={desk.ownerAddress}
              deskAddress={desk.address}
              openservLinked={openserv.linked.length}
              telegram={{
                linked: telegram.linked ? { username: telegram.linked.username } : null,
                pending: telegram.pending
                  ? { code: telegram.pending.code, expiresAt: telegram.pending.codeExpiresAt.toISOString() }
                  : null,
              }}
            />
          </Section>
          <Section title={s.share.title} body={s.share.body}>
            <ShareToggle deskId={desk.id} initial={{ enabled: desk.shareEnabled, slug: desk.shareSlug }} />
          </Section>
          <Section title={s.disclosure.title}>
            <Disclosure
              acceptedOn={accepted ? accepted.toLocaleDateString('en-GB', { dateStyle: 'medium' }) : null}
            />
          </Section>
          <Section title={s.appearance.title} body={s.appearance.body}>
            <ThemeToggle />
          </Section>
          {desk.lifecycle !== 'closed' && (
            <Section title={s.close.title} body={s.close.body}>
              <CloseDeskButton
                view={{
                  deskId: desk.id,
                  slug,
                  address: desk.address,
                  owner: desk.ownerAddress,
                  mode: desk.mode,
                  state: desk.state,
                  lifecycle: desk.lifecycle,
                  assistantRemoved: false,
                  shadowChecks: desk.shadowChecks,
                  goLiveChecks: 0,
                  reportOpened: desk.shadowReportOpenedAt !== null,
                  cashUsdg: null,
                  perActionCapUsdg: null,
                  dailyCapUsdg: null,
                  mandate: null,
                  tokens: [],
                  presets: [],
                }}
              />
            </Section>
          )}
        </div>
      </DeskSessionProvider>
    </div>
  )
}

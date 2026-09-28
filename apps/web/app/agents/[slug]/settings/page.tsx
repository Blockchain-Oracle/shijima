import {
  deskById,
  deskIdBySlug,
  disclosureAccepted,
  openservPulse,
  ownerIdOf,
  telegramForOwner,
} from '@desk/db'
import { DISCLOSURE_VERSION, settingsCopy as s } from '@desk/shared'
import { TriangleAlert } from 'lucide-react'
import type { Route } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { DeskControls, ModeSwitch, TradingStatus } from '@/features/desk/DeskControls'
import { DeskSessionProvider } from '@/features/session/DeskSessionProvider'
import { OwnerSessionPanel } from '@/features/session/OwnerSessionPanel'
import { AgentSettingsTabs } from '@/features/settings/AgentSettingsTabs'
import { CloseDeskButton } from '@/features/settings/CloseDeskButton'
import { Connections } from '@/features/settings/Connections'
import { Disclosure } from '@/features/settings/Disclosure'
import { PlanPanel } from '@/features/settings/PlanPanel'
import { SharingPanel } from '@/features/settings/SharingPanel'
import { controlsOf } from '@/lib/controls'
import { db } from '@/lib/db'
import { loadDesk } from '@/lib/desk.server'
import { signedInAddress } from '@/lib/session'

export const dynamic = 'force-dynamic'

const pulseView = (p: Awaited<ReturnType<typeof openservPulse>>) => ({
  lastRun: p.lastRun?.toISOString() ?? null,
  runs24h: p.runs24h,
  lastServ: p.lastServ?.toISOString() ?? null,
  servCalls24h: p.servCalls24h,
})

export const metadata = { title: 'Settings' }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** One agent's settings (design brief 8.18): how it runs, connections (Telegram, wallet, agent), the share link, copying, the disclosure, and closing it. */
export default async function SettingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const viewer = await signedInAddress().catch(() => undefined)
  const id = UUID.test(slug) ? slug : await deskIdBySlug(db(), slug)
  const desk = id ? await deskById(db(), id) : undefined
  // Only the owner has settings. Anyone else gets the same answer as for a desk that does not exist.
  if (!desk || !viewer || viewer.toLowerCase() !== desk.ownerAddress.toLowerCase()) notFound()

  const ownerId = await ownerIdOf(db(), viewer)
  const [view, telegram, accepted, pulse] = await Promise.all([
    loadDesk(slug),
    ownerId ? telegramForOwner(db(), ownerId) : Promise.resolve({ linked: null, pending: null }),
    ownerId ? disclosureAccepted(db(), ownerId, DISCLOSURE_VERSION) : Promise.resolve(null),
    openservPulse(db()),
  ])

  const open = desk.lifecycle !== 'closed'
  const controls = view ? controlsOf(view) : null
  return (
    <div className="agent-settings">
      <header className="agent-settings-head">
        <Link href={`/agents/${slug}` as Route} className="agent-settings-back">
          ← {s.back}
        </Link>
        <h1>{s.titleShort}</h1>
        <p>{desk.name ?? 'Your agent'}</p>
      </header>
      <DeskSessionProvider
        owner={desk.ownerAddress}
        desk={desk.address as `0x${string}`}
        contractVersion={desk.contractVersion}
      >
        <AgentSettingsTabs
          labels={s.tabs}
          panels={{
            trading:
              controls && open ? (
                <div className="st-stack">
                  <section className="st-section">
                    <TradingStatus view={controls} />
                  </section>
                  <div>
                    <p className="st-kicker">{s.modeTitle}</p>
                    <ModeSwitch view={controls} />
                  </div>
                  <div>
                    <p className="st-kicker">{s.controlsTitle}</p>
                    <DeskControls view={controls} bare withoutMode withoutPlan />
                  </div>
                </div>
              ) : (
                <p className="na-note">{s.closed}</p>
              ),
            plan: view?.mandate ? <PlanPanel plan={view.mandate} controls={open ? controls : null} /> : null,
            connections: (
              <div className="st-stack">
                <Connections
                  deskId={desk.id}
                  ownerAddress={desk.ownerAddress}
                  deskAddress={desk.address}
                  pulse={pulseView(pulse)}
                  telegram={{
                    linked: telegram.linked ? { username: telegram.linked.username } : null,
                    pending: telegram.pending
                      ? {
                          code: telegram.pending.code,
                          expiresAt: telegram.pending.codeExpiresAt.toISOString(),
                        }
                      : null,
                  }}
                />
                {view && open && (
                  <details className="na-more">
                    <summary>{s.browserKey}</summary>
                    <div className="na-more-body">
                      <OwnerSessionPanel />
                    </div>
                  </details>
                )}
              </div>
            ),
            sharing: (
              <SharingPanel
                deskId={desk.id}
                initialShare={{ enabled: desk.shareEnabled, slug: desk.shareSlug }}
                copy={open ? { copyable: desk.copyable, feeUsdg: desk.copyFeeUsdg.toString() } : null}
              />
            ),
            agreement: (
              <div className="st-stack">
                <section className="st-section st-section--pad">
                  <Disclosure
                    acceptedOn={
                      accepted ? accepted.toLocaleDateString('en-GB', { dateStyle: 'medium' }) : null
                    }
                  />
                </section>
                {open && (
                  <section className="st-section st-section--pad st-danger" aria-labelledby="st-close-title">
                    <header className="sh-head">
                      <span className="sh-chip sh-chip--danger" aria-hidden="true">
                        <TriangleAlert />
                      </span>
                      <div className="sh-titles">
                        <span className="sh-step">{s.danger}</span>
                        <h3 id="st-close-title">{s.close.title}</h3>
                      </div>
                    </header>
                    <p className="sh-body">{s.close.body}</p>
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
                  </section>
                )}
              </div>
            ),
          }}
        />
      </DeskSessionProvider>
    </div>
  )
}

import { desksOfOwner, disclosureAccepted, openservForDesk, ownerIdOf, telegramForDesk } from '@desk/db'
import { appCopy, DISCLOSURE_VERSION, settingsCopy } from '@desk/shared'
import { ArrowRight, Link2, Palette, ScrollText, Wallet, Workflow } from 'lucide-react'
import type { Route } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import { WalletChip } from '@/components/shell/app/WalletChip'
import ThemeToggle from '@/components/shell/ThemeToggle'
import { TokenLogo } from '@/components/ui/token-logo'
import { DeskSessionProvider } from '@/features/session/DeskSessionProvider'
import { Connections } from '@/features/settings/Connections'
import { Disclosure } from '@/features/settings/Disclosure'
import { db } from '@/lib/db'
import { signedInAddress } from '@/lib/session'

export const dynamic = 'force-dynamic'
export const metadata = { title: appCopy.settings.meta }

function Section({
  id,
  title,
  body,
  children,
}: {
  id: string
  title: string
  body?: string
  children: ReactNode
}) {
  return (
    <section id={id} className="set-section">
      <h2 className="set-title">{title}</h2>
      {body && <p className="set-body">{body}</p>}
      {children}
    </section>
  )
}

/**
 * The account's settings, on 21st's Settings Sidebar Layout (28366): Connections first, because Telegram and
 * OpenServ are what owners came looking for; then the wallet and its gas, the agents, the disclosure and the
 * look. Settings that belong to one agent (limits, mode, sharing, copying, closing) stay on that agent.
 */
export default async function AccountSettings() {
  const address = await signedInAddress().catch(() => undefined)
  if (!address) redirect('/agents')
  const c = appCopy.settings

  const [desks, ownerId] = await Promise.all([desksOfOwner(db(), address), ownerIdOf(db(), address)])
  const open = desks.filter((d) => d.lifecycle !== 'closed')
  const [accepted, links] = await Promise.all([
    ownerId ? disclosureAccepted(db(), ownerId, DISCLOSURE_VERSION) : Promise.resolve(null),
    Promise.all(
      open.map(async (d) => {
        const [telegram, openserv] = await Promise.all([
          telegramForDesk(db(), d.id),
          openservForDesk(db(), d.id),
        ])
        return { desk: d, telegram, openserv }
      }),
    ),
  ])

  const nav = [
    { id: 'connections', label: c.nav.connections, icon: Link2 },
    { id: 'wallet', label: c.nav.wallet, icon: Wallet },
    { id: 'agents', label: c.nav.agents, icon: Workflow },
    { id: 'disclosure', label: c.nav.disclosure, icon: ScrollText },
    { id: 'appearance', label: c.nav.appearance, icon: Palette },
  ]

  return (
    <div className="app-container">
      <header className="ov-head">
        <div>
          <p className="ov-kicker">{c.kicker}</p>
          <h1 className="ov-title">{c.title}</h1>
        </div>
      </header>

      <div className="set-layout">
        <nav className="set-nav" aria-label={c.title}>
          {nav.map((n) => {
            const Icon = n.icon
            return (
              <a key={n.id} href={`#${n.id}`} className="set-nav-link">
                <Icon aria-hidden="true" className="size-4" />
                {n.label}
              </a>
            )
          })}
        </nav>

        <div className="set-main">
          <Section id="connections" title={c.nav.connections} body={c.connectionsBody}>
            {links.length === 0 ? (
              <p className="set-body">
                {c.noAgents}{' '}
                <Link href="/agents/new" className="text-accent">
                  {appCopy.sidebar.newAgent} →
                </Link>
              </p>
            ) : (
              links.map(({ desk, telegram, openserv }) => (
                <div key={desk.id} className="set-agent-block">
                  {links.length > 1 && <h3 className="set-agent-name">{desk.name ?? 'Agent'}</h3>}
                  <DeskSessionProvider
                    owner={address}
                    desk={desk.address as `0x${string}`}
                    contractVersion={desk.contractVersion}
                  >
                    <Connections
                      deskId={desk.id}
                      ownerAddress={address}
                      deskAddress={desk.address}
                      openservLinked={openserv.linked.length}
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
                  </DeskSessionProvider>
                </div>
              ))
            )}
          </Section>

          <Section id="wallet" title={c.nav.wallet} body={c.wallet.body}>
            <div className="set-wallet">
              <WalletChip address={address} />
            </div>
            <p className="set-body">{c.wallet.getGas}</p>
          </Section>

          <Section id="agents" title={c.nav.agents} body={c.agentsBody}>
            <ul className="set-agents">
              {desks.map((d) => (
                <li key={d.id}>
                  <Link href={`/agents/${d.shareSlug ?? d.id}/settings` as Route} className="set-agent-row">
                    <TokenLogo symbol="CASH" size={22} />
                    <span className="set-agent-label">{d.name ?? 'Agent'}</span>
                    <span className="set-agent-go">
                      {c.agentSettings} <ArrowRight aria-hidden="true" className="size-3.5" />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Section>

          <Section id="disclosure" title={settingsCopy.disclosure.title}>
            <Disclosure
              acceptedOn={accepted ? accepted.toLocaleDateString('en-GB', { dateStyle: 'medium' }) : null}
            />
          </Section>

          <Section id="appearance" title={c.nav.appearance} body={c.appearanceBody}>
            <ThemeToggle />
          </Section>
        </div>
      </div>
    </div>
  )
}

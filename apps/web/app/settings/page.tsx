import { deskAbi } from '@desk/chain'
import { desksOfOwner, disclosureAccepted, ensureOwner, telegramForOwner } from '@desk/db'
import { appCopy, DISCLOSURE_VERSION, deskCopy, settingsCopy, short } from '@desk/shared'
import { ArrowRight, Link2, ScrollText, Wallet, Workflow } from 'lucide-react'
import type { Route } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import type { Address } from 'viem'
import { WalletChip } from '@/components/shell/app/WalletChip'
import { TokenLogo } from '@/components/ui/token-logo'
import { AccountConnections } from '@/features/settings/Connections'
import { Disclosure } from '@/features/settings/Disclosure'
import { pub } from '@/lib/chain-build.server'
import { db } from '@/lib/db'
import { signedInAddress } from '@/lib/session'

export const dynamic = 'force-dynamic'
export const metadata = { title: appCopy.settings.meta }

const ZERO = '0x0000000000000000000000000000000000000000'

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="set-section">
      <h2 className="set-title">{title}</h2>
      {children}
    </section>
  )
}

/**
 * Who may act for one agent, read from its contract: the operator key (Shijima's agent, or nobody once removed)
 * and a live session key, if the owner granted one. v0 contracts have no session keys. A failed read is shown as
 * unknown rather than guessed.
 */
async function accessOf(address: string, version: string) {
  const at = address as Address
  const read = (functionName: 'operator' | 'session' | 'sessionExpiresAt') =>
    pub()
      .readContract({ address: at, abi: deskAbi, functionName })
      .catch(() => null)
  const [operator, session, until] = await Promise.all([
    read('operator'),
    version === 'v0' ? null : read('session'),
    version === 'v0' ? null : read('sessionExpiresAt'),
  ])
  const expires = typeof until === 'number' || typeof until === 'bigint' ? Number(until) * 1000 : 0
  const live = typeof session === 'string' && session !== ZERO && expires > Date.now()
  return {
    operator: typeof operator === 'string' ? operator : null,
    session: live ? { key: session as string, until: new Date(expires) } : null,
  }
}

/**
 * The account's settings (DECISIONS F4): only real controls. Connections (Telegram for the whole wallet, OpenServ
 * per agent), the wallet and its gas, each agent and who can act for it, and the disclosure. The theme lives in
 * the header; limits, mode, sharing, copying and closing live on each agent's own settings.
 */
export default async function AccountSettings() {
  const address = await signedInAddress().catch(() => undefined)
  if (!address) redirect('/agents')
  const c = appCopy.settings
  const a = c.access

  const [desks, owner] = await Promise.all([desksOfOwner(db(), address), ensureOwner(db(), address)])
  const open = desks.filter((d) => d.lifecycle !== 'closed')
  const [accepted, telegram, access] = await Promise.all([
    disclosureAccepted(db(), owner.id, DISCLOSURE_VERSION),
    telegramForOwner(db(), owner.id),
    Promise.all(open.map((d) => accessOf(d.address, d.contractVersion))),
  ])

  const nav = [
    { id: 'connections', label: c.nav.connections, icon: Link2 },
    { id: 'wallet', label: c.nav.wallet, icon: Wallet },
    { id: 'agents', label: c.nav.agents, icon: Workflow },
    { id: 'disclosure', label: c.nav.disclosure, icon: ScrollText },
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
          <Section id="connections" title={c.nav.connections}>
            <AccountConnections
              telegram={{
                linked: telegram.linked ? { username: telegram.linked.username } : null,
                pending: telegram.pending
                  ? { code: telegram.pending.code, expiresAt: telegram.pending.codeExpiresAt.toISOString() }
                  : null,
              }}
              agents={open.map((d) => ({ id: d.id, name: d.name ?? 'Agent' }))}
            />
          </Section>

          <Section id="wallet" title={c.nav.wallet}>
            <div className="set-wallet">
              <WalletChip address={address} />
            </div>
          </Section>

          <Section id="agents" title={c.nav.agents}>
            {desks.length === 0 ? (
              <p className="set-body">
                {c.none}{' '}
                <Link href="/agents/new" className="text-accent">
                  {appCopy.sidebar.newAgent} →
                </Link>
              </p>
            ) : (
              <ul className="set-agents">
                {desks.map((d) => {
                  const i = open.indexOf(d)
                  const acc = i >= 0 ? access[i] : undefined
                  return (
                    <li key={d.id} className="set-access">
                      <Link
                        href={`/agents/${d.shareSlug ?? d.id}/settings` as Route}
                        className="set-agent-row"
                      >
                        <TokenLogo symbol="CASH" size={22} />
                        <span className="set-agent-label">{d.name ?? 'Agent'}</span>
                        <span className="set-agent-go">
                          {c.agentSettings} <ArrowRight aria-hidden="true" className="size-3.5" />
                        </span>
                      </Link>
                      {acc ? (
                        <dl className="set-access-rows">
                          <div>
                            <dt>{a.mode}</dt>
                            <dd>{deskCopy.modes[d.mode]}</dd>
                          </div>
                          <div>
                            <dt>{a.trades}</dt>
                            <dd>
                              {acc.operator === null
                                ? '—'
                                : acc.operator === ZERO
                                  ? a.removed
                                  : a.trader(short(acc.operator, 6, 4))}
                            </dd>
                          </div>
                          <div>
                            <dt>{a.session}</dt>
                            <dd>
                              {acc.session
                                ? a.sessionUntil(
                                    short(acc.session.key, 6, 4),
                                    acc.session.until.toLocaleString('en-GB', {
                                      dateStyle: 'medium',
                                      timeStyle: 'short',
                                    }),
                                  )
                                : a.noSession}
                            </dd>
                          </div>
                          <div>
                            <dt>{a.withdraw}</dt>
                            <dd>{a.onlyYou}</dd>
                          </div>
                        </dl>
                      ) : (
                        <p className="set-body">{a.closed}</p>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </Section>

          <Section id="disclosure" title={settingsCopy.disclosure.title}>
            <Disclosure
              acceptedOn={accepted ? accepted.toLocaleDateString('en-GB', { dateStyle: 'medium' }) : null}
            />
          </Section>
        </div>
      </div>
    </div>
  )
}

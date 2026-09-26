import { deskAbi } from '@desk/chain'
import { desksOfOwner, disclosureAccepted, ensureOwner, openservPulse, telegramForOwner } from '@desk/db'
import { appCopy, DISCLOSURE_VERSION, deskCopy, short } from '@desk/shared'
import type { Route } from 'next'
import Link from 'next/link'
import type { Address } from 'viem'
import { Row, Screen, ScreenTitle } from '@/components/kit'
import { TokenLogo } from '@/components/ui/token-logo'
import { SignedOutCard } from '@/features/money/SignedOutCard'
import { AccountPanel } from '@/features/settings/AccountPanel'
import { AccountConnections } from '@/features/settings/Connections'
import { Disclosure } from '@/features/settings/Disclosure'
import { SettingsTabs } from '@/features/settings/SettingsTabs'
import { pub } from '@/lib/chain-build.server'
import { db } from '@/lib/db'
import { signedInAddress } from '@/lib/session'

export const dynamic = 'force-dynamic'

const pulseView = (p: Awaited<ReturnType<typeof openservPulse>>) => ({
  lastRun: p.lastRun?.toISOString() ?? null,
  runs24h: p.runs24h,
  lastServ: p.lastServ?.toISOString() ?? null,
  servCalls24h: p.servCalls24h,
})

export const metadata = { title: appCopy.settings.meta }

const ZERO = '0x0000000000000000000000000000000000000000'

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
 * The account's settings (DECISIONS F4): only real controls, one tab at a time. Account (the wallet, its gas, where
 * to check everything, the tour and disconnect), Connections (Telegram for the whole wallet, OpenServ per agent),
 * each agent and who can act for it, and the disclosure. Limits, mode, sharing, copying and closing live on each
 * agent's own settings.
 */
export default async function AccountSettings() {
  const address = await signedInAddress().catch(() => undefined)
  if (!address) return <SignedOutCard />
  const c = appCopy.settings
  const a = c.access

  const [desks, owner] = await Promise.all([desksOfOwner(db(), address), ensureOwner(db(), address)])
  const open = desks.filter((d) => d.lifecycle !== 'closed')
  const [accepted, telegram, access, pulse] = await Promise.all([
    disclosureAccepted(db(), owner.id, DISCLOSURE_VERSION),
    telegramForOwner(db(), owner.id),
    Promise.all(open.map((d) => accessOf(d.address, d.contractVersion))),
    openservPulse(db()),
  ])

  const agentsList =
    desks.length === 0 ? (
      <Row
        top
        label={
          <>
            {c.none}{' '}
            <Link href="/agents/new" style={{ color: 'var(--ac2)' }}>
              {appCopy.sidebar.newAgent} →
            </Link>
          </>
        }
      />
    ) : (
      desks.map((d, index) => {
        const i = open.indexOf(d)
        const acc = i >= 0 ? access[i] : undefined
        return (
          <div key={d.id} style={{ borderTop: index === 0 ? 'none' : '1px solid var(--bd)' }}>
            <Link
              href={`/agents/${d.shareSlug ?? d.id}/settings` as Route}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '14px 18px 6px',
                color: 'var(--tx)',
                textDecoration: 'none',
                fontWeight: 700,
                fontSize: 13.5,
              }}
            >
              <TokenLogo symbol="CASH" size={22} />
              {d.name ?? 'Agent'}
              <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--ac2)', fontWeight: 600 }}>
                {c.agentSettings} →
              </span>
            </Link>
            {acc ? (
              <dl className="kit-dl">
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
              <p style={{ margin: 0, padding: '0 18px 14px', fontSize: 12.5, color: 'var(--tx3)' }}>
                {a.closed}
              </p>
            )}
          </div>
        )
      })
    )

  return (
    <Screen width={760} gap={8}>
      <ScreenTitle title={c.title} sub={c.sub} />
      <SettingsTabs
        labels={{
          account: c.groups.account,
          connections: c.groups.connections,
          agents: c.groups.access,
          agreement: c.groups.agreed,
        }}
        panels={{
          account: <AccountPanel address={address} />,
          connections: (
            <AccountConnections
              telegram={{
                linked: telegram.linked ? { username: telegram.linked.username } : null,
                pending: telegram.pending
                  ? { code: telegram.pending.code, expiresAt: telegram.pending.codeExpiresAt.toISOString() }
                  : null,
              }}
              agents={open.map((d) => ({ id: d.id, name: d.name ?? 'Agent' }))}
              pulse={pulseView(pulse)}
            />
          ),
          agents: <section className="st-section">{agentsList}</section>,
          agreement: (
            <section className="st-section st-section--pad">
              <Disclosure
                acceptedOn={accepted ? accepted.toLocaleDateString('en-GB', { dateStyle: 'medium' }) : null}
              />
            </section>
          ),
        }}
      />
    </Screen>
  )
}

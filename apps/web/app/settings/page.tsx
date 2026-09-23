import { deskAbi } from '@desk/chain'
import { desksOfOwner, disclosureAccepted, ensureOwner, telegramForOwner } from '@desk/db'
import { appCopy, DISCLOSURE_VERSION, deskCopy, short } from '@desk/shared'
import type { Route } from 'next'
import Link from 'next/link'
import type { Address } from 'viem'
import { Group, Row, Screen, ScreenTitle } from '@/components/kit'
import { WalletChip } from '@/components/shell/app/WalletChip'
import { TokenLogo } from '@/components/ui/token-logo'
import { SignedOutCard } from '@/features/money/SignedOutCard'
import { AccountConnections } from '@/features/settings/Connections'
import { Disclosure } from '@/features/settings/Disclosure'
import { SettingsSide } from '@/features/settings/SettingsSide'
import { pub } from '@/lib/chain-build.server'
import { db } from '@/lib/db'
import { signedInAddress } from '@/lib/session'

export const dynamic = 'force-dynamic'
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
 * The account's settings (DECISIONS F4): only real controls. Connections (Telegram for the whole wallet, OpenServ
 * per agent), the wallet and its gas, each agent and who can act for it, and the disclosure. The theme lives in
 * the header; limits, mode, sharing, copying and closing live on each agent's own settings.
 */
export default async function AccountSettings() {
  const address = await signedInAddress().catch(() => undefined)
  if (!address) return <SignedOutCard />
  const c = appCopy.settings
  const a = c.access

  const [desks, owner] = await Promise.all([desksOfOwner(db(), address), ensureOwner(db(), address)])
  const open = desks.filter((d) => d.lifecycle !== 'closed')
  const [accepted, telegram, access] = await Promise.all([
    disclosureAccepted(db(), owner.id, DISCLOSURE_VERSION),
    telegramForOwner(db(), owner.id),
    Promise.all(open.map((d) => accessOf(d.address, d.contractVersion))),
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
    <Screen width={960} gap={8}>
      <ScreenTitle title={c.title} sub={c.sub} />
      <div className="kit-settings">
        <div className="kit-settings-main">
          <Group title={c.groups.account} id="wallet">
            <Row top label={c.address}>
              <span style={{ fontFamily: 'var(--fm)' }}>{short(address, 6, 4)}</span>
            </Row>
            <div style={{ padding: '4px 18px 16px', borderTop: '1px solid var(--bd)' }}>
              <p style={{ margin: '12px 0 10px', fontSize: 12.5, color: 'var(--tx2)' }}>{c.gas}</p>
              <WalletChip address={address} />
            </div>
          </Group>

          <Group title={c.groups.connections} id="connections">
            <div style={{ padding: 16 }}>
              <AccountConnections
                telegram={{
                  linked: telegram.linked ? { username: telegram.linked.username } : null,
                  pending: telegram.pending
                    ? { code: telegram.pending.code, expiresAt: telegram.pending.codeExpiresAt.toISOString() }
                    : null,
                }}
                agents={open.map((d) => ({ id: d.id, name: d.name ?? 'Agent' }))}
              />
            </div>
          </Group>

          <Group title={c.groups.access} id="agents">
            {agentsList}
          </Group>

          <Group title={c.groups.agreed} id="disclosure">
            <div style={{ padding: 16 }}>
              <Disclosure
                acceptedOn={accepted ? accepted.toLocaleDateString('en-GB', { dateStyle: 'medium' }) : null}
              />
            </div>
          </Group>
        </div>
        <div className="kit-settings-side">
          <SettingsSide verifyHref="/evidence" />
        </div>
      </div>
    </Screen>
  )
}

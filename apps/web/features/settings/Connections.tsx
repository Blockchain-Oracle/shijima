'use client'

import { EXPLORER } from '@desk/chain'
import { appCopy, OPENSERV, settingsCopy, short } from '@desk/shared'
import { ArrowUpRight, Check } from 'lucide-react'
import Link from 'next/link'
import { type ReactNode, useState } from 'react'
import type { TelegramState } from '@/app/owner-actions'
import { BrandLogo } from '@/components/ui/brand-logo'
import { ChainLogo } from '@/components/ui/chain-logo'
import { Modal } from '@/components/ui/modal'
import { OpenservConnect } from './OpenservConnect'
import { TelegramConnect } from './TelegramConnect'

const c = settingsCopy.connections

/**
 * One integration, after 21st's Connect Integration Cards (7ovr, 28170): the mark, the name, one line, and a footer
 * with its status and the action. Everything else (codes, QR, steps, addresses) opens in a dialog.
 */
function IntegrationCard({
  mark,
  name,
  body,
  status,
  action,
  children,
}: {
  mark: ReactNode
  name: string
  body: string
  status: { on: boolean; label: string }
  action: string
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="int-card">
      <span className="int-mark" aria-hidden="true">
        {mark}
      </span>
      <h3 className="int-name">{name}</h3>
      <p className="int-body">{body}</p>
      <div className="int-foot">
        <span className="int-status" data-on={status.on ? '' : undefined}>
          {status.on && <Check className="size-3.5" aria-hidden="true" />}
          {status.label}
        </span>
        <button type="button" className="int-action" onClick={() => setOpen(true)}>
          {action}
          <ArrowUpRight className="size-4" aria-hidden="true" />
        </button>
      </div>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        eyebrow={c.title}
        title={name}
        description={body}
        closeLabel={c.close}
      >
        {children}
      </Modal>
    </div>
  )
}

function Out({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="connection-link">
      {children}
      <ArrowUpRight className="size-3.5" aria-hidden />
    </a>
  )
}

const telegramStatus = (t: TelegramState) =>
  t?.linked
    ? { on: true, label: t.linked.username ? `@${t.linked.username}` : c.on }
    : { on: false, label: c.off }

/** The account's connections (DECISIONS F4, F6): Telegram once for the wallet, then OpenServ per agent. */
export function AccountConnections({
  telegram,
  agents,
}: {
  telegram: TelegramState
  agents: { id: string; name: string }[]
}) {
  return (
    <div className="int-grid">
      <IntegrationCard
        mark={<BrandLogo brand="telegram" size={28} />}
        name={settingsCopy.telegram.title}
        body={settingsCopy.telegram.body}
        status={telegramStatus(telegram)}
        action={telegram?.linked ? c.manage : c.connect}
      >
        <TelegramConnect initial={telegram} />
      </IntegrationCard>
      <IntegrationCard
        mark={<BrandLogo brand="openserv" size={26} />}
        name={appCopy.settings.openserv.title}
        body={appCopy.openserv.tagline}
        status={{ on: false, label: agents.length === 0 ? appCopy.settings.openserv.none : c.off }}
        action={c.connect}
      >
        {agents.length === 0 ? (
          <p className="na-note">
            {appCopy.settings.openserv.none}{' '}
            <Link href="/agents/new" className="text-accent">
              {appCopy.sidebar.newAgent} →
            </Link>
          </p>
        ) : (
          agents.map((a) => (
            <div key={a.id} className="flex flex-col gap-2">
              {agents.length > 1 && <h4 className="type-body-strong text-ink">{a.name}</h4>}
              <OpenservConnect deskId={a.id} />
            </div>
          ))
        )}
      </IntegrationCard>
    </div>
  )
}

/** One agent's connections: Telegram, the wallet that owns it, and the OpenServ agent that checks it. */
export function Connections({
  deskId,
  ownerAddress,
  deskAddress,
  telegram,
  openservLinked = 0,
}: {
  deskId: string
  ownerAddress: string
  deskAddress: string
  telegram: TelegramState
  /** How many OpenServ workspaces this desk is linked to. */
  openservLinked?: number
}) {
  return (
    <div className="int-grid">
      <IntegrationCard
        mark={<BrandLogo brand="telegram" size={28} />}
        name={settingsCopy.telegram.title}
        body={settingsCopy.telegram.body}
        status={telegramStatus(telegram)}
        action={telegram?.linked ? c.manage : c.connect}
      >
        <TelegramConnect initial={telegram} />
      </IntegrationCard>
      <IntegrationCard
        mark={<BrandLogo brand="openserv" size={26} />}
        name={c.agent}
        body={c.agentBody}
        status={{ on: openservLinked > 0, label: openservLinked > 0 ? c.linkedCount(openservLinked) : c.off }}
        action={openservLinked > 0 ? c.manage : c.connect}
      >
        <dl className="connection-rows">
          <div>
            <dt>OpenServ</dt>
            <dd>{c.agentId(OPENSERV.agentId)}</dd>
          </div>
          <div>
            <dt>ERC-8004</dt>
            <dd>#{OPENSERV.identity.tokenId}</dd>
          </div>
        </dl>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <Out href={OPENSERV.agentUrl}>{c.openAgent}</Out>
          <Out href={OPENSERV.identity.url}>{c.openIdentity}</Out>
        </div>
        <OpenservConnect deskId={deskId} />
      </IntegrationCard>
      <IntegrationCard
        mark={<ChainLogo chainId={4663} size={28} />}
        name={c.wallet}
        body={c.walletBody}
        status={{ on: true, label: short(ownerAddress, 6, 4) }}
        action={c.details}
      >
        <dl className="connection-rows">
          <div>
            <dt>{c.owner}</dt>
            <dd title={ownerAddress}>{short(ownerAddress, 6, 4)}</dd>
          </div>
          <div>
            <dt>{c.desk}</dt>
            <dd title={deskAddress}>{short(deskAddress, 6, 4)}</dd>
          </div>
        </dl>
        <Out href={`${EXPLORER}/address/${deskAddress}`}>{c.view}</Out>
      </IntegrationCard>
    </div>
  )
}

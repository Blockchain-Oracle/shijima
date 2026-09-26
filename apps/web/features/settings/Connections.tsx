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

/** The OpenServ pulse as the page receives it: ISO times, so it crosses from server to browser as plain data. */
export interface PulseView {
  lastRun: string | null
  runs24h: number
  lastServ: string | null
  servCalls24h: number
}

/** "13:02" today, "Fri 13:02" on another day, in the reader's own time zone. */
const hhmm = (iso: string | null) => {
  if (!iso) return null
  const at = new Date(iso)
  const time = at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return at.toDateString() === new Date().toDateString()
    ? time
    : `${at.toLocaleDateString([], { weekday: 'short' })} ${time}`
}

/**
 * OpenServ, shown working rather than "not connected": the hourly workflow that wakes the agent, the SERV calls it
 * reasons with, and its IDs. Linking your own workspace is an advanced extra, folded away (DECISIONS R9).
 */
function OpenservCard({ pulse, children }: { pulse: PulseView | null; children?: ReactNode }) {
  const o = c.openserv
  const fresh = pulse?.lastRun ? Date.now() - new Date(pulse.lastRun).getTime() < 2 * 60 * 60 * 1000 : false
  return (
    <IntegrationCard
      mark={<BrandLogo brand="openserv" size={26} />}
      name={o.name}
      body={o.body}
      status={{ on: fresh, label: fresh ? o.running(hhmm(pulse?.lastRun ?? null) ?? '') : o.waiting }}
      action={c.details}
    >
      <ul className="int-facts">
        <li>
          <b>{o.schedTitle}</b>
          <span>{o.sched(hhmm(pulse?.lastRun ?? null), pulse?.runs24h ?? 0)}</span>
        </li>
        <li>
          <b>{o.servTitle}</b>
          <span>{o.serv(hhmm(pulse?.lastServ ?? null), pulse?.servCalls24h ?? 0)}</span>
        </li>
        <li>
          <b>{o.idTitle}</b>
          <span>{o.id(OPENSERV.agentId, OPENSERV.identity.tokenId)}</span>
          <span className="flex flex-wrap gap-x-4 gap-y-1">
            <Out href={OPENSERV.agentUrl}>{c.openAgent}</Out>
            <Out href={OPENSERV.identity.url}>{c.openIdentity}</Out>
            <Out href="/compare">{appCopy.credit.compare}</Out>
          </span>
        </li>
      </ul>
      {children && (
        <details className="na-more">
          <summary>{o.advanced}</summary>
          <div className="na-more-body">{children}</div>
        </details>
      )}
    </IntegrationCard>
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
  pulse = null,
}: {
  telegram: TelegramState
  agents: { id: string; name: string }[]
  pulse?: PulseView | null
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
      <OpenservCard pulse={pulse}>
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
      </OpenservCard>
    </div>
  )
}

/** One agent's connections: Telegram, the wallet that owns it, and the OpenServ agent that checks it. */
export function Connections({
  deskId,
  ownerAddress,
  deskAddress,
  telegram,
  pulse = null,
}: {
  deskId: string
  ownerAddress: string
  deskAddress: string
  telegram: TelegramState
  pulse?: PulseView | null
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
      <OpenservCard pulse={pulse}>
        <OpenservConnect deskId={deskId} />
      </OpenservCard>
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

import { EXPLORER } from '@desk/chain'
import { appCopy, OPENSERV, settingsCopy, short } from '@desk/shared'
import { ArrowUpRight } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'
import type { TelegramState } from '@/app/owner-actions'
import { BrandLogo } from '@/components/ui/brand-logo'
import { ChainLogo } from '@/components/ui/chain-logo'
import { OpenservConnect } from './OpenservConnect'
import { TelegramConnect } from './TelegramConnect'

const c = settingsCopy.connections

/** One card in 21st's Connect Integration Cards shape (28170): a tile for the mark, a title, a line, a footer. */
function Card({
  icon,
  title,
  body,
  children,
  wide = false,
}: {
  icon: ReactNode
  title: string
  body: string
  children: ReactNode
  wide?: boolean
}) {
  return (
    <div className={`connection-card${wide ? ' connection-card--wide' : ''}`}>
      <span className="connection-mark" aria-hidden>
        {icon}
      </span>
      <h3 className="type-body-strong text-ink">{title}</h3>
      <p className="type-caption text-ink-secondary">{body}</p>
      <div className="connection-foot">{children}</div>
    </div>
  )
}

function Out({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="connection-link" data-cursor="hover">
      {children}
      <ArrowUpRight className="size-3.5" aria-hidden />
    </a>
  )
}

/**
 * The account's Connections (DECISIONS F4, F6): Telegram once, for the wallet and every agent in it, then OpenServ,
 * whose workspaces link to one agent each, so it is listed per agent.
 */
export function AccountConnections({
  telegram,
  agents,
}: {
  telegram: TelegramState
  agents: { id: string; name: string }[]
}) {
  return (
    <div className="connections-grid">
      <Card
        wide
        icon={<BrandLogo brand="telegram" size={28} />}
        title={settingsCopy.telegram.title}
        body={settingsCopy.telegram.body}
      >
        <TelegramConnect initial={telegram} />
      </Card>
      <Card
        wide
        icon={<BrandLogo brand="openserv" size={26} />}
        title={appCopy.settings.openserv.title}
        body={appCopy.openserv.tagline}
      >
        {agents.length === 0 ? (
          <p className="type-caption text-ink-muted">
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
      </Card>
    </div>
  )
}

/**
 * One agent's Connections (UX-PLAN §6): Telegram (the wallet's, shown here too), and the two
 * fixed links, the wallet that owns the desk and the OpenServ agent that checks it. Each fixed card points at the
 * public page where anyone can confirm it.
 */
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
    <div className="connections-grid">
      <Card
        wide
        icon={<BrandLogo brand="telegram" size={28} />}
        title={settingsCopy.telegram.title}
        body={settingsCopy.telegram.body}
      >
        <TelegramConnect initial={telegram} />
      </Card>
      <Card icon={<ChainLogo chainId={4663} size={28} />} title={c.wallet} body={c.walletBody}>
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
      </Card>
      <Card wide icon={<BrandLogo brand="openserv" size={26} />} title={c.agent} body={c.agentBody}>
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
      </Card>
    </div>
  )
}

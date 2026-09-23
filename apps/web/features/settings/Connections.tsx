import { EXPLORER } from '@desk/chain'
import { OPENSERV, settingsCopy, short } from '@desk/shared'
import { ArrowUpRight, Bot, Send, Wallet } from 'lucide-react'
import type { ReactNode } from 'react'
import type { TelegramState } from '@/app/owner-actions'
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
 * Settings' Connections group (UX-PLAN §6): Telegram, which the owner connects and disconnects here, and the two
 * fixed links, the wallet that owns the desk and the OpenServ agent that checks it. Each fixed card points at the
 * public page where anyone can confirm it.
 */
export function Connections({
  deskId,
  ownerAddress,
  deskAddress,
  telegram,
}: {
  deskId: string
  ownerAddress: string
  deskAddress: string
  telegram: TelegramState
}) {
  return (
    <div className="connections-grid">
      <Card
        wide
        icon={<Send className="size-5" />}
        title={settingsCopy.telegram.title}
        body={settingsCopy.telegram.body}
      >
        <TelegramConnect deskId={deskId} initial={telegram} />
      </Card>
      <Card icon={<Wallet className="size-5" />} title={c.wallet} body={c.walletBody}>
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
      <Card icon={<Bot className="size-5" />} title={c.agent} body={c.agentBody}>
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
      </Card>
    </div>
  )
}

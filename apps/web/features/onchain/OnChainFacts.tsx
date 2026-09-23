import { EXPLORER } from '@desk/chain'
import { onchainCopy as C, OPENSERV, short } from '@desk/shared'
import { ArrowUpRight, Boxes, Fingerprint, type LucideIcon, UserRound, Wallet } from 'lucide-react'
import './onchain.css'

interface Fact {
  key: string
  icon: LucideIcon
  label: string
  what: string
  when?: string
  href: string
  shown: string
}

/**
 * What is live on chain, each piece with what it is for and a link that opens it (DECISIONS F1). `account` is the
 * example agent account: the live showcase on the landing, the owner's own newest agent on the Overview.
 */
function factsOf(factory: string, account: { address: string; mine: boolean } | undefined): Fact[] {
  return [
    {
      key: 'factory',
      icon: Boxes,
      label: C.factory.label,
      what: C.factory.what,
      when: C.factory.when,
      href: `${EXPLORER}/address/${factory}`,
      shown: short(factory),
    },
    ...(account
      ? [
          {
            key: 'account',
            icon: Wallet,
            label: C.account.label,
            what: C.account.what,
            when: account.mine ? C.account.yours : C.account.example,
            href: `${EXPLORER}/address/${account.address}`,
            shown: short(account.address),
          },
        ]
      : []),
    {
      key: 'agent',
      icon: UserRound,
      label: C.agent.label,
      what: C.agent.what,
      href: OPENSERV.agentUrl,
      shown: `#${OPENSERV.agentId}`,
    },
    {
      key: 'identity',
      icon: Fingerprint,
      label: C.identity.label,
      what: C.identity.what,
      href: OPENSERV.identity.url,
      shown: `#${OPENSERV.identity.tokenId}`,
    },
  ]
}

/** The landing's strip, right under the hero: four cells, each a fact you can open. */
export function OnChainFacts({
  factory,
  account,
}: {
  factory: string
  account?: { address: string; mine: boolean } | undefined
}) {
  const facts = factsOf(factory, account)
  return (
    <div className="oc">
      <div className="oc-head">
        <span className="oc-eyebrow">
          <i aria-hidden />
          {C.eyebrow}
        </span>
        <h2 className="oc-title">{C.title}</h2>
        <p className="oc-desc">{C.desc}</p>
      </div>
      <ul className="oc-grid">
        {facts.map((f) => {
          const Icon = f.icon
          return (
            <li key={f.key}>
              <a href={f.href} target="_blank" rel="noreferrer noopener" className="oc-cell">
                <span className="oc-cell-top">
                  <Icon aria-hidden className="size-4" />
                  <span className="oc-label">{f.label}</span>
                  <ArrowUpRight aria-hidden className="oc-go size-4" />
                </span>
                <span className="oc-what">{f.what}</span>
                <span className="oc-foot">
                  <code>{f.shown}</code>
                  {f.when ? <span>{f.when}</span> : null}
                </span>
              </a>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/** The Overview's card: the same facts as rows, one line each. */
export function OnChainCard({
  factory,
  account,
}: {
  factory: string
  account?: { address: string } | undefined
}) {
  const facts = factsOf(factory, account ? { address: account.address, mine: true } : undefined)
  return (
    <section className="ov-card" aria-labelledby="ov-onchain">
      <div className="ov-card-head">
        <h2 id="ov-onchain">
          <span className="oc-dot" aria-hidden />
          {C.compactTitle}
        </h2>
        <p>{C.eyebrow}</p>
      </div>
      {facts.map((f) => {
        const Icon = f.icon
        return (
          <a
            key={f.key}
            href={f.href}
            target="_blank"
            rel="noreferrer noopener"
            className="ov-connect-row"
            title={f.what}
          >
            <Icon aria-hidden className="size-4" />
            <span>{f.key === 'account' ? C.account.yours : f.label}</span>
            <span className="ov-connect-state oc-row-value">
              {f.shown} <ArrowUpRight aria-hidden className="inline size-3.5" />
            </span>
          </a>
        )
      })}
    </section>
  )
}

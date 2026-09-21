import { APPROVED_TOKENS } from '@desk/chain'
import { desksOfOwner } from '@desk/db'
import { PRESETS } from '@desk/shared'
import Link from 'next/link'
import { CreateDesk } from '@/components/create-desk'
import { MandateForm } from '@/components/mandate-form'
import { currentDeployment } from '@/lib/chain'
import { db } from '@/lib/db'
import { signedInAddress } from '@/lib/session'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Open a desk' }

/**
 * The whole way in, on one page: make the account, then say what you want held.
 *
 * It is deliberately short. The disclosure is not buried, and the desk starts in practice mode whatever the
 * owner chooses, so the first thing anyone sees it do costs them nothing.
 */
export default async function Start() {
  const address = await signedInAddress()
  const desks = address ? await desksOfOwner(db(), address) : []
  const existing = desks[0]
  const deployment = currentDeployment()

  return (
    <div className="max-w-2xl space-y-8">
      <header className="space-y-2">
        <h1 className="font-semibold text-2xl tracking-tight">Open a desk</h1>
        <p className="text-ink-soft leading-relaxed">
          A desk is an account on the network that belongs to you. Only you can take money out of it. You give
          an assistant permission to trade inside it, within limits the network itself enforces, and you can
          remove that permission at any time.
        </p>
      </header>

      <section className="space-y-3 rounded-lg border border-line bg-surface p-4">
        <h2 className="font-medium">Before you do</h2>
        <ul className="space-y-1 text-ink-soft text-sm leading-relaxed">
          <li>
            Stock Tokens follow the price of a US stock or fund. They are <strong>not shares</strong>: holding
            one gives you no ownership of the company and no shareholder rights.
          </li>
          <li>
            They are not available to people in the United States, the United Kingdom, Canada or Switzerland.
          </li>
          <li>
            The desk contract is small and has no way to be upgraded or administered, and it has{' '}
            <strong>not been audited</strong>. Use small amounts.
          </li>
          <li>
            The assistant cannot send your money to anyone. If its key were stolen, the worst it could do is
            make bad trades, costing at most 8% of your daily limit per day, until you remove it.
          </li>
          <li>The desk does not predict prices and claims no edge. It can be wrong about timing.</li>
        </ul>
      </section>

      {!address ? (
        <p className="text-ink-soft">Connect your wallet and sign in above to begin.</p>
      ) : existing ? (
        <section className="space-y-4">
          <h2 className="font-medium">Say what you want held</h2>
          <p className="text-ink-soft text-sm">
            Your desk is at <code className="font-mono text-xs">{existing.address}</code>. Choose the split
            you want it kept to. It starts in practice mode: it decides for real and spends nothing.
          </p>
          <MandateForm
            deskId={existing.id}
            presets={PRESETS}
            tokens={APPROVED_TOKENS.map((t) => ({ symbol: t.symbol, name: t.displayName }))}
          />
          <section className="space-y-2 rounded-lg border border-line p-4">
            <h3 className="font-medium text-sm">Putting money in</h3>
            <p className="text-ink-soft text-sm leading-relaxed">
              Send USDG on Robinhood Chain to your desk's address above. USDG is a digital US dollar, and it
              is the cash the desk trades with. If your money is on another network, Relay can bridge it
              straight to that address:{' '}
              <a
                href="https://relay.link/bridge/robinhood"
                className="text-accent hover:underline"
                rel="noreferrer noopener"
              >
                relay.link/bridge/robinhood
              </a>
              . You will also want a few cents of ETH on Robinhood Chain for your own transactions. The
              assistant pays the fees for everything it does.
            </p>
            <p className="text-ink-faint text-xs">
              Bringing money in from another network in one step, inside this page, is not built yet. Until it
              is, this is the honest way to do it.
            </p>
          </section>

          <Link href="/desks" className="inline-block text-accent text-sm hover:underline">
            Your desks →
          </Link>
        </section>
      ) : (
        <CreateDesk factory={deployment.factory} operator={deployment.operator} />
      )}
    </div>
  )
}

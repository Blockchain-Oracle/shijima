import { APPROVED_TOKENS, EXPLORER } from '@desk/chain'
import { COST_MULTIPLE, MIN_TRADE_USDG } from '@desk/core'
import { usd } from '@desk/shared'

export const metadata = { title: 'How the desk decides' }

/**
 * The published rules. A desk that says "trust me" is worth nothing, so every rule it follows is written here
 * in the same words the record uses, and the numbers come from the code rather than from a copy of it.
 */
export default function HowItWorks() {
  return (
    <div className="max-w-2xl space-y-8">
      <header className="space-y-2">
        <h1 className="font-semibold text-2xl tracking-tight">How the desk decides</h1>
        <p className="text-ink-soft">
          Every rule it follows, in the order it applies them. It does not improvise, and it never predicts a
          price.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="font-medium">What you decide, and what it decides</h2>
        <p className="text-ink-soft text-sm leading-relaxed">
          You choose what to hold and in what proportions, for example 40% Nvidia, 30% an S&P 500 fund and 30%
          cash. That is your mandate. If you put in $10,000, the desk works toward $4,000, $3,000 and $3,000.
          It never invents a holding and never changes your proportions. When your holdings drift away from
          them, the desk decides only <strong>when</strong> to correct that: now, part of it now, wait for the
          market to reopen, or not at all.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-medium">Every check, in order</h2>
        <ol className="space-y-3 text-ink-soft text-sm leading-relaxed">
          <li>
            <strong className="text-ink">1. It reads your account.</strong> Balances, limits and whether the
            assistant still has access. If anything changed without the desk doing it, it says so and moves
            your loss-limit baseline by that amount, so money you added or took out is never mistaken for a
            loss.
          </li>
          <li>
            <strong className="text-ink">2. It values what you hold</strong> on the trading pool's average
            price over the last half hour, never on the last official update, which is frozen while the market
            is shut. If a price cannot be read, that holding is not valued, not traded, and your loss limit is
            not judged at all, because a number we cannot source is not a number we act on.
          </li>
          <li>
            <strong className="text-ink">3. Plain arithmetic finds what drifted.</strong> No assistant is
            involved. A holding must be further than your tolerance from its target, and the drift must be
            worth at least {COST_MULTIPLE} times what the trade costs. Nothing under {usd(MIN_TRADE_USDG)} is
            ever worth the network fee.
          </li>
          <li>
            <strong className="text-ink">4. Code refuses what it must,</strong> before anything is asked. It
            will not touch a token whose trading is paused, whose price feed is unavailable or unconfirmed,
            whose price is more than 8% from the last official update, whose price is moving fast right now,
            or that you have not allowed. If it has no news it will not act on an ordinary rebalance.
          </li>
          <li>
            <strong className="text-ink">5. Only then is an assistant asked one question:</strong> now or
            later? It sees the session, the price against the reference, what the trade costs, the status of
            the token and recent headlines about the company. It answers with one of four options, its
            confidence, its reasons, and every option it turned down and why.
          </li>
          <li>
            <strong className="text-ink">6. Arithmetic checks your limits again</strong> and can refuse what
            the assistant chose. It repeats the exact sums your desk contract will do, so nothing is sent that
            the network would reject. The assistant can never get past this step.
          </li>
          <li>
            <strong className="text-ink">7. What happens then depends on your mode.</strong> In practice mode
            it records what it would have done and spends nothing. In ask-first it asks you, and the request
            expires at the next check. On its own, it acts, and still asks when an action is unusually large.
          </li>
          <li>
            <strong className="text-ink">8. Everything is written down,</strong> including the times it did
            nothing, and each record is fingerprinted on the public network.
          </li>
        </ol>
      </section>

      <section className="space-y-3">
        <h2 className="font-medium">What it will never do</h2>
        <ul className="space-y-1 text-ink-soft text-sm leading-relaxed">
          <li>It cannot send your money to anyone but you. Only you can withdraw.</li>
          <li>It cannot spend more than your per-action or daily limit. The network refuses it.</li>
          <li>It cannot trade a token you have not allowed, or through a pool you did not pin.</li>
          <li>It does not predict prices, pick companies, or claim an edge.</li>
          <li>
            If a weekend price moves more than 8% from the last official update, its trades are refused by
            your desk contract. Only you can sell then. The record says so and you are told.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-medium">The Stock Tokens it may hold</h2>
        <p className="text-ink-soft text-sm">
          Chosen for having both a price feed and a pool deep enough to trade without moving the price.
        </p>
        <ul className="grid grid-cols-2 gap-1 text-sm sm:grid-cols-3">
          {APPROVED_TOKENS.map((t) => (
            <li key={t.address} className="text-ink-soft">
              <span className="text-ink">{t.symbol}</span> {t.displayName}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-medium">If this website disappears</h2>
        <p className="text-ink-soft text-sm leading-relaxed">
          Your money is in your own account on the network, not with us. You can withdraw it without this site
          and without our help, using any block explorer: open your desk's address on{' '}
          <a href={EXPLORER} className="text-accent hover:underline" rel="noreferrer noopener">
            the explorer
          </a>
          , connect the wallet that owns it, and call <code className="font-mono text-xs">withdraw</code> with
          the token address and the amount. The assistant cannot stop you, and it can never do this itself.
        </p>
      </section>
    </div>
  )
}

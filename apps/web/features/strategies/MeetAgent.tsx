import { studioCopy } from '@desk/shared'
import { Check } from 'lucide-react'
import { ShijimaMark } from '@/components/shell/ShijimaMark'

const M = studioCopy.meet

/**
 * The last step opens with the agent itself, before any signature: what it will look after, what it decides and
 * what it never does, in the first person. The same promises the account enforces, said by who keeps them.
 */
export function MeetAgent({
  amount,
  basket,
  perAction,
  daily,
}: {
  /** "$20.00", or null when starting in practice with no money. */
  amount: string | null
  basket: string
  perAction: string
  daily: string
}) {
  const lines = [
    amount ? M.look(amount, basket) : M.lookPractice(basket),
    M.when,
    M.limits(perAction, daily),
    M.practice,
    M.tell,
  ]
  return (
    <section className="meet-agent" aria-label={M.name}>
      <div className="meet-agent-head">
        <span className="meet-agent-avatar" aria-hidden>
          <ShijimaMark />
        </span>
        <div>
          <p className="strat-micro text-ink-muted">{M.kicker}</p>
          <p className="meet-agent-name">
            {M.name} <span lang="ja">しじま</span>
          </p>
        </div>
      </div>
      <ul className="meet-agent-lines">
        {lines.map((l) => (
          <li key={l}>
            <Check aria-hidden />
            {l}
          </li>
        ))}
      </ul>
    </section>
  )
}

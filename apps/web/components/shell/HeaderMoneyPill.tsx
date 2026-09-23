import { usd, webCopy } from '@desk/shared'
import Link from 'next/link'

/**
 * Agari's balance pill (`HeaderMoneyPill.tsx`): one compact total, here what the owner's desks held at their
 * last check. Until a desk has been valued it shows an em dash, never a zero. Adding money arrives with the
 * owner controls, and with it the pill's vermilion "+".
 */
export function HeaderMoneyPill({ totalUsdg }: { totalUsdg: string | null }) {
  const amount = totalUsdg === null ? '—' : usd(BigInt(totalUsdg))
  return (
    <Link
      href="/agents"
      title={webCopy.moneyPill.title}
      aria-label={webCopy.moneyPill.aria(amount)}
      className="dusdc-pill"
      data-cursor="hover"
    >
      <span className={`dusdc-total${totalUsdg === null ? ' dusdc-total--dim' : ''}`}>{amount}</span>
      <span className="dusdc-unit">{webCopy.moneyPill.unit}</span>
    </Link>
  )
}

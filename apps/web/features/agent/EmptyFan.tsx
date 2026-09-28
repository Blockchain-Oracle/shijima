import type { ReactNode } from 'react'
import { TokenLogo } from '@/components/ui/token-logo'

/**
 * An empty block that still shows what it is about, after 21st's Empty State (1435): three tiles fanned out, here
 * the agent's own stocks by their real logos (cash when it has none), over a title, a sentence and one line under.
 */
export function EmptyFan({
  symbols,
  title,
  body,
  foot,
}: {
  symbols: string[]
  title: string
  body: string
  foot?: ReactNode
}) {
  const three = (symbols.length > 0 ? symbols : ['USDG']).slice(0, 3)
  return (
    <div className="ap-empty">
      <div className="ap-empty-fan" data-count={three.length} aria-hidden="true">
        {three.map((sym) => (
          <span key={sym} className="ap-empty-tile">
            <TokenLogo symbol={sym} size={26} />
          </span>
        ))}
      </div>
      <p className="ap-empty-title">{title}</p>
      <p className="ap-empty-body">{body}</p>
      {foot ? <p className="ap-empty-foot">{foot}</p> : null}
    </div>
  )
}

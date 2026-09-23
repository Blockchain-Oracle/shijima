import { CASH_LOOK, lookOf } from '@desk/shared'
import { cn } from '@/lib/utils'

/**
 * A Stock Token's face: its brand mark on a round tile, or a monogram tile for the funds and anything without a
 * mark. `symbol="CASH"` draws the cash tile. Decorative by default, because the name is always written beside it.
 */
export function TokenLogo({
  symbol,
  size = 28,
  className,
  title,
}: {
  symbol: string
  size?: number
  className?: string
  /** Set when the logo stands alone, with no name next to it. */
  title?: string
}) {
  const look = symbol.toUpperCase() === 'CASH' ? CASH_LOOK : lookOf(symbol)
  const a11y = title ? { role: 'img' as const, 'aria-label': title } : { 'aria-hidden': true as const }
  return (
    <span
      {...a11y}
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full ring-1 ring-black/10 dark:ring-white/10',
        className,
      )}
      style={{ width: size, height: size, background: look.tile }}
    >
      {look.logo ? (
        // biome-ignore lint/performance/noImgElement: a tiny static SVG from /public; next/image adds nothing here.
        <img src={`/tokens/${look.logo}`} alt="" width={size * 0.58} height={size * 0.58} draggable={false} />
      ) : (
        <span
          className="font-[family-name:var(--font-heading)] leading-none font-semibold tracking-tight"
          style={{
            color: look.ink,
            fontSize:
              size *
              (look.monogram.length > 3
                ? 0.2
                : look.monogram.length > 2
                  ? 0.25
                  : look.monogram.length > 1
                    ? 0.34
                    : 0.46),
          }}
        >
          {look.monogram}
        </span>
      )}
    </span>
  )
}

/**
 * Overlapping logos with a "+N" chip, after 21st's Avatar Stack (28355). Shows the heaviest first, so a basket
 * reads by what matters most in it.
 */
export function TokenStack({
  symbols,
  max = 4,
  size = 28,
  className,
}: {
  symbols: string[]
  max?: number
  size?: number
  className?: string
}) {
  const shown = symbols.slice(0, max)
  const rest = symbols.length - shown.length
  return (
    <span className={cn('inline-flex items-center', className)}>
      {shown.map((s, i) => (
        <span
          key={s}
          className="rounded-full ring-2 ring-[var(--color-surface-1)]"
          style={{ marginLeft: i === 0 ? 0 : -size * 0.15, zIndex: shown.length - i }}
        >
          <TokenLogo symbol={s} size={size} />
        </span>
      ))}
      {rest > 0 && (
        <span
          className="inline-flex items-center justify-center rounded-full bg-[var(--color-surface-3)] font-[family-name:var(--font-data)] text-[var(--color-ink-secondary)] ring-2 ring-[var(--color-surface-1)]"
          style={{ width: size, height: size, marginLeft: -size * 0.15, fontSize: size * 0.36 }}
        >
          +{rest}
        </span>
      )}
    </span>
  )
}

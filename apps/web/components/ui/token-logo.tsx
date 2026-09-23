import { CASH_LOOK } from '@desk/shared'
import { AssetDisc } from '@/features/markets/marks'
import { cn } from '@/lib/utils'

/**
 * A Stock Token's face: Agari's asset disc (`AssetDisc`, the brand's colour with its white glyph, a monogram for a
 * fund), at any size, so the strategies, the studio, the desk and the record wear the same marks as the markets
 * pages. `symbol="CASH"` draws cash's quiet tile. Decorative by default, because the name is written beside it.
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
  const a11y = title ? { role: 'img' as const, 'aria-label': title } : { 'aria-hidden': true as const }
  if (symbol.toUpperCase() === 'CASH') {
    return (
      <span
        {...a11y}
        className={cn(
          'inline-flex shrink-0 items-center justify-center rounded-full font-semibold',
          className,
        )}
        style={{
          width: size,
          height: size,
          background: CASH_LOOK.tile,
          color: CASH_LOOK.ink,
          fontSize: size * 0.46,
        }}
      >
        {CASH_LOOK.monogram}
      </span>
    )
  }
  return (
    <span
      {...a11y}
      className={cn('inline-flex shrink-0 rounded-full', className)}
      style={{ width: size, height: size }}
    >
      <AssetDisc symbol={symbol.toUpperCase()} className="token-disc" />
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

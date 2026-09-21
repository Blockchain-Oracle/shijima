import { cn } from '@/lib/utils'
import { glyphTransform, MARK_GLYPHS } from './mark-paths'

/**
 * Agari's asset disc (`features/markets/hero/asset-mark.tsx` and `AssetMarkSvg.tsx`), for our ten Stock Tokens:
 * the brand's colour with its white glyph, or a typed monogram for a fund. The fills live in `icons.css`.
 */
const BRANDS: Record<string, { slug: string; monogram: string }> = {
  NVDA: { slug: 'nvidia', monogram: 'N' },
  AAPL: { slug: 'apple', monogram: 'A' },
  MSFT: { slug: 'microsoft', monogram: 'M' },
  GOOGL: { slug: 'google', monogram: 'G' },
  AMZN: { slug: 'amazon', monogram: 'A' },
  META: { slug: 'meta', monogram: 'M' },
  TSLA: { slug: 'tesla', monogram: 'T' },
  SPY: { slug: 'spdr', monogram: 'S' },
  QQQ: { slug: 'invesco', monogram: 'Q' },
  SGOV: { slug: 'ishares', monogram: 'T' },
}

/** The funds: no company, so no reports, and a monogram rather than a mark. */
export const FUNDS = new Set(['SPY', 'QQQ', 'SGOV'])

function MarkSvg({ slug, monogram }: { slug: string; monogram: string }) {
  const glyph = MARK_GLYPHS[slug]
  return (
    <svg viewBox="0 0 32 32" className="asset-mark" aria-hidden focusable="false">
      <circle cx="16" cy="16" r="16" className={`mark-${slug}-disc`} />
      {glyph?.ring && <circle cx="16" cy="16" r="15.5" className="mark-ring" />}
      {glyph ? (
        <path className="mark-glyph" transform={glyphTransform(glyph)} d={glyph.d} />
      ) : (
        <text className="mark-monogram" x="16" y="16.5">
          {monogram}
        </text>
      )}
    </svg>
  )
}

/** The disc that names a Stock Token. `className` is the disc's slot: `mh-asset-badge`, `glyph`, `tkh-mark`. */
export function AssetDisc({ symbol, className }: { symbol: string; className: string }) {
  const brand = BRANDS[symbol]
  if (!brand) {
    return (
      <span aria-hidden className={cn(className, 'generic')}>
        <span>{symbol.slice(0, 1)}</span>
      </span>
    )
  }
  return (
    <span aria-hidden className={cn(className, 'has-mark')} data-brand={brand.slug}>
      <MarkSvg slug={brand.slug} monogram={brand.monogram} />
    </span>
  )
}

/** A strategy's members as overlapping discs, like Agari's news mark cluster: at most four, then a count. */
export function DiscCluster({ symbols, className }: { symbols: string[]; className?: string }) {
  const shown = symbols.slice(0, 4)
  const more = symbols.length - shown.length
  return (
    <span className={cn('mk-cluster', className)} aria-hidden>
      {shown.map((s) => (
        <AssetDisc key={s} symbol={s} className="mk-cluster-disc" />
      ))}
      {more > 0 && <span className="mk-cluster-more">+{more}</span>}
    </span>
  )
}

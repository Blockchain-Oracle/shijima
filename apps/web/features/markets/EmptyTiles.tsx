import type { ReactNode } from 'react'

/**
 * A designed empty state for the discover pages, after 21st's Empty State (1435): three tilted tiles over a dashed
 * card, which fan out on hover, then one bold line and the reason. The tiles carry the page's own marks (a logo or
 * an icon), so an empty list still says what would be in it.
 */
export function EmptyTiles({
  tiles,
  title,
  body,
  className,
}: {
  tiles: [ReactNode, ReactNode, ReactNode]
  title: string
  body?: string
  className?: string
}) {
  return (
    <div className={className ? `dc-empty ${className}` : 'dc-empty'}>
      <div className="dc-empty-tiles" aria-hidden="true">
        {tiles.map((t, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: three fixed decorative slots
          <span key={i}>{t}</span>
        ))}
      </div>
      <b>{title}</b>
      {body && <p>{body}</p>}
    </div>
  )
}

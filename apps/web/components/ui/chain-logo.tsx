import { cn } from '@/lib/utils'

/** The chains money moves between, with their published logos (vendored from Relay into public/logos/chains). */
export const CHAIN_LOGOS: Record<number, { name: string; src: string }> = {
  4663: { name: 'Robinhood Chain', src: '/logos/chains/4663.webp' },
  8453: { name: 'Base', src: '/logos/chains/8453.png' },
  42161: { name: 'Arbitrum', src: '/logos/chains/42161.png' },
  1: { name: 'Ethereum', src: '/logos/chains/1.png' },
  56: { name: 'BNB Chain', src: '/logos/chains/56.png' },
}

/** A chain's logo in a rounded tile. Decorative unless `title` is set, since its name is usually beside it. */
export function ChainLogo({
  chainId,
  size = 20,
  className,
  title,
}: {
  chainId: number
  size?: number
  className?: string
  title?: string
}) {
  const chain = CHAIN_LOGOS[chainId]
  if (!chain) {
    return (
      <span
        aria-hidden="true"
        className={cn('inline-block shrink-0 rounded-md', className)}
        style={{ width: size, height: size, background: 'var(--card2)' }}
      />
    )
  }
  return (
    // biome-ignore lint/performance/noImgElement: a fixed local logo; next/image adds nothing here
    <img
      alt={title ?? ''}
      aria-hidden={title ? undefined : true}
      src={chain.src}
      width={size}
      height={size}
      className={cn('inline-block shrink-0 object-cover', className)}
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.28) }}
    />
  )
}

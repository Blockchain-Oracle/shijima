'use client'

import { type CSSProperties, type ReactNode, useState } from 'react'

/**
 * The reference wallet's two boundary surfaces (packages/ui/src/cards.tsx), renamed for Shijima.
 *   AgentsCard  was ShieldedCard: the money inside your agents. Accent wash, a 118° hatch and a sweeping sheen.
 *               With `back`, a tap cross-fades to the back face (one row per agent), as the reference's notes face.
 *   WalletCard  was PublicCard: your own wallet. An amber wash behind a dashed border.
 */

const HATCH = 'repeating-linear-gradient(118deg, transparent 0 11px, var(--sh-hatch) 11px 12px)'

export function AgentsCard({
  children,
  back,
  style,
  label = 'Show one row per agent',
}: {
  children: ReactNode
  back?: ReactNode
  style?: CSSProperties
  label?: string
}) {
  const [flipped, setFlipped] = useState(false)
  const flippable = Boolean(back)
  const Tag = flippable ? 'button' : 'div'
  return (
    <Tag
      {...(flippable
        ? {
            type: 'button' as const,
            onClick: () => setFlipped((v) => !v),
            'aria-pressed': flipped,
            'aria-label': label,
          }
        : {})}
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 18,
        border: '1px solid var(--bd2)',
        backgroundImage: `${HATCH}, var(--sh-grad)`,
        backgroundColor: 'var(--card)',
        backdropFilter: 'blur(8px)',
        cursor: flippable ? 'pointer' : 'default',
        textAlign: 'left',
        color: 'inherit',
        font: 'inherit',
        padding: 0,
        display: 'block',
        width: '100%',
        ...style,
      }}
    >
      <span
        aria-hidden="true"
        className="animate-kitSheen"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '45%',
          height: '100%',
          background: 'linear-gradient(100deg, transparent, rgb(255 255 255 / 0.08), transparent)',
          pointerEvents: 'none',
        }}
      />
      <span
        style={{
          position: 'relative',
          display: 'block',
          height: '100%',
          transition: 'opacity .35s ease',
          opacity: flipped ? 0 : 1,
          visibility: flipped ? 'hidden' : 'visible',
        }}
      >
        {children}
      </span>
      {flippable ? (
        <span
          style={{
            position: 'absolute',
            inset: 0,
            display: 'block',
            transition: 'opacity .35s ease',
            opacity: flipped ? 1 : 0,
            visibility: flipped ? 'visible' : 'hidden',
          }}
        >
          {back}
        </span>
      ) : null}
    </Tag>
  )
}

export function WalletCard({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      style={{
        position: 'relative',
        borderRadius: 18,
        border: '1px dashed var(--pub-bd)',
        backgroundImage: 'var(--pub-grad)',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

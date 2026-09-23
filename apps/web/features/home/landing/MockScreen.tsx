'use client'

import type { Route } from 'next'
import { useEffect, useRef, useState } from 'react'

/**
 * One of our own pages, live, in a frame scaled down to the card (the reference's MockScreen, which showed a
 * static designer page instead). The frame renders at its natural size and is scaled by the card's width; a
 * ResizeObserver keeps the scale right, and `maxHeight` crops the bottom. It mounts only once the card is near
 * the screen, so a visitor who never scrolls to it never loads it. Decorative: hidden from assistive tech, never
 * focusable, never clickable. It must never frame `/`, which would frame itself.
 */
export function MockScreen({
  src,
  width,
  height,
  radius = 18,
  maxHeight,
  title = 'A live Shijima page',
}: {
  src: Route
  /** Named for completeness; the frame is hidden from assistive tech either way. */
  title?: string
  width: number
  height: number
  radius?: number
  /** Crops the bottom: the wrapper never grows past this, in CSS px. */
  maxHeight?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0)
  const [seen, setSeen] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node) return
    const resize = new ResizeObserver(() => setScale(node.clientWidth / width))
    resize.observe(node)
    const view = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true)
          view.disconnect()
        }
      },
      { rootMargin: '200px' },
    )
    view.observe(node)
    return () => {
      resize.disconnect()
      view.disconnect()
    }
  }, [width])

  const natural = Math.round(height * (scale || 0.3))
  return (
    <div
      ref={ref}
      className="mock-screen"
      style={{ height: maxHeight ? Math.min(natural, maxHeight) : natural, borderRadius: radius }}
      aria-hidden
      inert
    >
      {scale > 0 && seen ? (
        <iframe
          src={src}
          title={title}
          tabIndex={-1}
          loading="lazy"
          scrolling="no"
          style={{
            width,
            height,
            border: 0,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            pointerEvents: 'none',
            background: 'transparent',
          }}
        />
      ) : null}
    </div>
  )
}

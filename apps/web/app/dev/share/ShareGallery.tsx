'use client'

import { useEffect, useState } from 'react'
import { type DecisionCard, decisionTweet, renderDecisionCard } from '@/features/share/decision-card'

/** Draws each card with the real renderer and shows the PNG at a quarter of its width, with its post below. */
export function ShareGallery({ cards }: { cards: DecisionCard[] }) {
  const [images, setImages] = useState<Record<string, string>>({})
  // The site's own origin, read after hydration so the server and the browser render the same first frame.
  const [origin, setOrigin] = useState('')
  useEffect(() => setOrigin(window.location.origin), [])
  useEffect(() => {
    let alive = true
    const urls: string[] = []
    void (async () => {
      for (const card of cards) {
        const blob = await renderDecisionCard(card, `${window.location.origin}${card.path}`)
        const url = URL.createObjectURL(blob)
        urls.push(url)
        if (alive) setImages((prior) => ({ ...prior, [card.folio]: url }))
      }
    })()
    return () => {
      alive = false
      for (const url of urls) URL.revokeObjectURL(url)
    }
  }, [cards])
  return (
    <div className="dev-share-grid">
      {cards.map((card) => (
        <figure key={card.folio} className="flex w-[400px] max-w-full flex-col gap-2">
          {images[card.folio] ? (
            // biome-ignore lint/performance/noImgElement: a blob URL drawn in the browser, not a static asset
            <img className="dev-share-png" src={images[card.folio]} alt={`${card.hero} ${card.label}`} />
          ) : (
            <div className="dev-share-png aspect-video bg-surface-2" />
          )}
          <figcaption className="type-caption text-ink-muted">
            {decisionTweet(card, `${origin}${card.path}`)}
          </figcaption>
        </figure>
      ))}
    </div>
  )
}

'use client'

import { shareCopy } from '@desk/shared'
import { type DecisionCard, decisionTweet, renderDecisionCard } from './decision-card'
import { useShareCard } from './useShareCard'

/** "Share card ↗", Agari's `ShareTradeButton`, for one decision on a shared desk. */
export function ShareDecisionButton({ card }: { card: DecisionCard }) {
  const { busy, share } = useShareCard()
  return (
    <button
      type="button"
      className="share-link"
      disabled={busy}
      aria-busy={busy}
      onClick={() => {
        const url = `https://shijima.xyz${card.path}`
        void share({
          render: () => renderDecisionCard(card, url),
          fileName: card.fileName,
          text: decisionTweet(card, url),
        })
      }}
    >
      {busy ? shareCopy.rendering : `${shareCopy.shareCard} ↗`}
    </button>
  )
}

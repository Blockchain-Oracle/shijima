'use client'

import { howCopy } from '@desk/shared'
import { ChevronDown, HelpCircle } from 'lucide-react'
import { useId, useState } from 'react'
import { riseDelay } from './rise'

/** Agari's stagger for FAQ rows: `0.5 + index * 0.05`. */
const FAQ_BASE_MS = 500
const FAQ_STEP_MS = 50

/**
 * Agari's accordion (`features/how-it-works/Faq.tsx`): one row open at a time, the chevron turning, the answer in a
 * grid row that goes 0fr to 1fr and stays in the DOM so a screen reader can reach it.
 */
export function Faq({ faqs }: { faqs: readonly { question: string; answer: string }[] }) {
  const [open, setOpen] = useState<number | null>(null)
  const baseId = useId()
  return (
    <section className="hiw-section" aria-label={howCopy.sections.faq}>
      <h2 className="hiw-label">
        <HelpCircle aria-hidden />
        {howCopy.sections.faq}
      </h2>
      <div className="hiw-faq">
        {faqs.map((faq, index) => {
          const isOpen = open === index
          const panelId = `${baseId}-${index}`
          const buttonId = `${panelId}-q`
          return (
            <div
              key={faq.question}
              className="hiw-faq-item hiw-rise"
              data-open={isOpen}
              style={riseDelay(0, FAQ_BASE_MS + index * FAQ_STEP_MS)}
            >
              <button
                id={buttonId}
                type="button"
                className="hiw-faq-q"
                onClick={() => setOpen(isOpen ? null : index)}
                aria-expanded={isOpen}
                aria-controls={panelId}
                data-cursor="hover"
              >
                <span>{faq.question}</span>
                <ChevronDown className="hiw-faq-chevron" aria-hidden />
              </button>
              <section id={panelId} className="hiw-faq-a" aria-labelledby={buttonId} aria-hidden={!isOpen}>
                <div>
                  <p className="hiw-body-dim">{faq.answer}</p>
                </div>
              </section>
            </div>
          )
        })}
      </div>
    </section>
  )
}

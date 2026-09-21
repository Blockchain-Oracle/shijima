'use client'

import { X } from 'lucide-react'
import { type ReactNode, useEffect, useId } from 'react'

/**
 * Agari's one overlay grammar (`styles/agari/modal.css`): a centred panel over a blurred scrim, never a bottom
 * sheet. Escape and the scrim close it, the page behind stops scrolling, and the body scrolls while the head
 * stays put.
 */
export function Modal({
  open,
  onClose,
  eyebrow,
  title,
  description,
  closeLabel,
  children,
}: {
  open: boolean
  onClose: () => void
  eyebrow: string
  title: string
  description?: string | undefined
  closeLabel: string
  children: ReactNode
}) {
  const titleId = useId()
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="modal-root">
      <button type="button" className="modal-scrim" aria-label={closeLabel} tabIndex={-1} onClick={onClose} />
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <button
          type="button"
          onClick={onClose}
          aria-label={closeLabel}
          className="modal-close"
          data-cursor="hover"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="modal-head">
          <div className="modal-eyebrow-row">
            <span className="modal-eyebrow-dot" />
            <span className="modal-eyebrow">{eyebrow}</span>
          </div>
          <h2 id={titleId} className="modal-title">
            {title}
          </h2>
          {description && <p className="modal-desc">{description}</p>}
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}

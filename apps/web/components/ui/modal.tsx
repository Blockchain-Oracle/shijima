'use client'

import { X } from 'lucide-react'
import { type ReactNode, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

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
  const panel = useRef<HTMLDivElement>(null)
  const close = useRef(onClose)
  close.current = onClose
  // Drawn at the page root: inside the app frame a fixed panel is clipped by the frame, not the screen.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  useEffect(() => {
    if (!open || !mounted) return
    const previousFocus = document.activeElement as HTMLElement | null
    const frame = requestAnimationFrame(() => {
      if (!panel.current?.contains(document.activeElement))
        panel.current?.querySelector<HTMLElement>('input, button')?.focus()
    })
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        close.current()
      }
      if (event.key === 'Tab') {
        const items = panel.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), a[href], select:not(:disabled), [tabindex="0"]',
        )
        const first = items?.[0]
        const last = items?.[items.length - 1]
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last?.focus()
        }
        if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first?.focus()
        }
      }
    }
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      cancelAnimationFrame(frame)
      previousFocus?.focus()
      document.removeEventListener('keydown', onKey)
    }
  }, [open, mounted])

  if (!open || !mounted) return null
  return createPortal(
    <div className="modal-root">
      <button type="button" className="modal-scrim" aria-label={closeLabel} tabIndex={-1} onClick={onClose} />
      <div ref={panel} className="modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
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
    </div>,
    document.body,
  )
}

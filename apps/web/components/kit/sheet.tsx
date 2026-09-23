'use client'

import { type ReactNode, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useSheetDrag } from './gestures'

/**
 * The reference phone app's bottom sheet (MobileSheetOverlay.tsx + mobile-flows.css): a shade, a panel that rises
 * from the bottom with a grabber, closed by dragging it down, tapping the shade, or Escape. Focus moves into the
 * sheet when it opens and back when it closes.
 */
export function BottomSheet({
  open,
  onClose,
  label,
  tall,
  children,
}: {
  open: boolean
  onClose: () => void
  label: string
  tall?: boolean
  children: ReactNode
}) {
  const drag = useSheetDrag(onClose)
  const panel = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    panel.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      previous?.focus?.()
    }
  }, [open, onClose])

  if (!open || typeof document === 'undefined') return null
  return createPortal(
    // biome-ignore lint/a11y/noStaticElementInteractions: the shade closes on a tap, as in the reference; Escape does the same.
    // biome-ignore lint/a11y/useKeyWithClickEvents: Escape is handled on the document.
    <div className="kit-sheet-layer" onClick={onClose}>
      <section
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className={tall ? 'kit-sheet kit-sheet--tall' : 'kit-sheet'}
        style={drag.sheetStyle}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        {...drag.handlers}
      >
        <div className="kit-sheet-grabber" aria-hidden="true" />
        {children}
      </section>
    </div>,
    document.body,
  )
}

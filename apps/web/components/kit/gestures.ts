'use client'

import { type CSSProperties, type TouchEvent, useRef, useState } from 'react'

/**
 * The reference phone app's gestures (apps/mobile/src/mobile-gestures.ts): drag a sheet down to close it, and
 * pull a page down to refresh it. Haptics use the browser's vibrate call where it exists, and nothing elsewhere.
 */

export function hapticTap() {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate?.(8)
}

function hapticResult(ok: boolean) {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate?.(ok ? 14 : [20, 40, 20])
}

/** Drag-to-dismiss for bottom sheets: follows the finger down, springs back under 130px, closes past it. */
export function useSheetDrag(onDismiss: () => void) {
  const [offset, setOffset] = useState(0)
  const [settling, setSettling] = useState(false)
  const start = useRef<{ y: number; scrollable: boolean } | null>(null)

  const onTouchStart = (event: TouchEvent<HTMLElement>) => {
    const touch = event.touches[0]
    if (!touch) return
    // Only start a drag when the sheet body is scrolled to the top.
    start.current = { y: touch.clientY, scrollable: event.currentTarget.scrollTop > 2 }
    setSettling(false)
  }

  const onTouchMove = (event: TouchEvent<HTMLElement>) => {
    const touch = event.touches[0]
    if (!start.current || start.current.scrollable || !touch) return
    const delta = touch.clientY - start.current.y
    setOffset(delta > 0 ? delta : 0)
  }

  const settleBack = () => {
    start.current = null
    setSettling(true)
    setOffset(0)
  }

  const onTouchEnd = () => {
    if (!start.current) return
    if (offset > 130) {
      hapticTap()
      onDismiss()
      start.current = null
      setOffset(0)
      return
    }
    settleBack()
  }

  return {
    sheetStyle: {
      transform: offset > 0 || settling ? `translateY(${offset}px)` : undefined,
      transition: settling
        ? 'transform 0.34s cubic-bezier(0.22, 1.2, 0.36, 1)'
        : offset > 0
          ? 'none'
          : undefined,
    } as CSSProperties,
    handlers: { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel: settleBack },
  }
}

const PULL_THRESHOLD = 74

/**
 * Pull-to-refresh on the page: at the top, pull past the threshold and let go to refresh. A failure shows for
 * 2.6 seconds and never leaves a spinning wheel behind.
 */
export function usePullToRefresh(onRefresh: () => unknown, scroller: () => number) {
  const [pull, setPull] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const [failed, setFailed] = useState(false)
  const start = useRef<number | null>(null)

  const onTouchStart = (event: TouchEvent<HTMLElement>) => {
    const touch = event.touches[0]
    start.current = touch && scroller() <= 1 && !refreshing ? touch.clientY : null
  }

  const onTouchMove = (event: TouchEvent<HTMLElement>) => {
    const touch = event.touches[0]
    if (start.current === null || !touch) return
    const delta = touch.clientY - start.current
    setPull(delta > 0 ? Math.min(120, delta * 0.45) : 0)
  }

  const reset = () => {
    start.current = null
    setPull(0)
  }

  const onTouchEnd = () => {
    if (start.current === null) return
    if (pull >= PULL_THRESHOLD * 0.45) {
      hapticTap()
      setRefreshing(true)
      setFailed(false)
      reset()
      void Promise.resolve()
        .then(onRefresh)
        .then(
          () => hapticResult(true),
          () => {
            setFailed(true)
            hapticResult(false)
            window.setTimeout(() => setFailed(false), 2600)
          },
        )
        .finally(() => setRefreshing(false))
      return
    }
    reset()
  }

  return {
    pull,
    refreshing,
    failed,
    handlers: { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel: reset },
  }
}

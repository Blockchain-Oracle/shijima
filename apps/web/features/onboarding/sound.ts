'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

const SRC = '/sounds/welcome.mp3'
const MUTED = 'shijima.sound.v1'

/**
 * The welcome chime, as the reference intro plays it (packages/ui/src/onboarding.tsx): one track, loaded when the
 * tour opens and started by the first press inside it, never before, so a fresh page load is silent. `play` is
 * idempotent and a refused attempt retries on the next press. Muting is remembered on this browser.
 */
export function useWelcomeSound(active: boolean) {
  const [muted, setMuted] = useState(false)
  const mutedRef = useRef(false)
  const audio = useRef<HTMLAudioElement | null>(null)
  const started = useRef(false)

  useEffect(() => {
    try {
      const off = window.localStorage.getItem(MUTED) === 'off'
      mutedRef.current = off
      setMuted(off)
    } catch {}
  }, [])

  useEffect(() => {
    if (!active) return
    const a = new Audio(SRC)
    // Soft on purpose (Abu, 23 Sep): a chime under the voice of the page, never over it.
    a.volume = 0.22
    a.preload = 'auto'
    audio.current = a
    started.current = false
    return () => {
      // StrictMode mounts twice in development: stop the first one so two never overlap.
      a.pause()
      audio.current = null
    }
  }, [active])

  const play = useCallback(() => {
    const a = audio.current
    if (!a || started.current || mutedRef.current) return
    started.current = true
    a.play().catch(() => {
      started.current = false
    })
  }, [])

  const toggle = useCallback(() => {
    const next = !mutedRef.current
    mutedRef.current = next
    setMuted(next)
    if (next) audio.current?.pause()
    try {
      window.localStorage.setItem(MUTED, next ? 'off' : 'on')
    } catch {}
  }, [])

  return { muted, toggle, play }
}

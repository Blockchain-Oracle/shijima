'use client'

import { useRouter } from 'next/navigation'
import { startTransition, useEffect } from 'react'

/** Data screens refresh; settings, onboarding and money forms keep their explicit confirmation flow. */
export function isLiveDataPath(path: string) {
  return (
    /^\/(wallet|activity|evidence|live|markets|reels|discover|strategies)$/.test(path) ||
    (/^\/agents(?:\/[^/]+)?$/.test(path) && path !== '/agents/new') ||
    /^\/stock\/[^/]+$/.test(path)
  )
}

export function useLiveRefresh(path: string) {
  const router = useRouter()
  useEffect(() => {
    if (!isLiveDataPath(path)) return
    const refresh = () => {
      if (document.visibilityState !== 'visible' || !navigator.onLine) return
      if (document.activeElement?.matches('input, textarea, select, [contenteditable="true"]')) return
      startTransition(() => router.refresh())
    }
    const timer = setInterval(refresh, 30_000)
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [path, router])
}

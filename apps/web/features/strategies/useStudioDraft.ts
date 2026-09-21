'use client'

import type { Preset } from '@desk/shared'
import { useCallback, useEffect, useState } from 'react'
import { initialDraft, type StudioDraft, withPreset } from './draft'

const KEY = 'shijima.studio.draft'

/**
 * The studio's draft, kept in this browser as Masayume keeps an unfinished setup, so a closed tab loses nothing.
 * Storage can be blocked or empty; the studio then simply starts fresh. A preset in the address (from "Start a
 * desk with this" on the markets page) wins over a saved draft, because it is what the owner just asked for.
 */
export function useStudioDraft(presets: Preset[], requested: string | undefined) {
  const [draft, setDraft] = useState<StudioDraft>(() => initialDraft(presets.find((p) => p.id === requested)))
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    const preset = presets.find((p) => p.id === requested)
    let saved: StudioDraft | null = null
    try {
      const raw = window.localStorage.getItem(KEY)
      saved = raw
        ? ({ ...initialDraft(), ...(JSON.parse(raw) as Partial<StudioDraft>) } as StudioDraft)
        : null
    } catch {
      saved = null
    }
    if (saved) setDraft(preset ? withPreset(saved, preset) : saved)
    setHydrated(true)
  }, [presets, requested])

  useEffect(() => {
    if (!hydrated) return
    try {
      window.localStorage.setItem(KEY, JSON.stringify(draft))
    } catch {
      // Blocked storage: the draft lives for this visit only.
    }
  }, [draft, hydrated])

  const reset = useCallback(() => {
    try {
      window.localStorage.removeItem(KEY)
    } catch {}
    setDraft(initialDraft())
  }, [])

  return { draft, setDraft, reset }
}

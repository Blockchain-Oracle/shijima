'use client'

import { useEffect, useState } from 'react'

const WORD_MS = 24

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(query.matches)
    const on = () => setReduced(query.matches)
    query.addEventListener('change', on)
    return () => query.removeEventListener('change', on)
  }, [])
  return reduced
}

/**
 * The reply revealing itself word by word, from Masayume's Sensei via Agari (`features/sensei/Typewriter.tsx`).
 * Whitespace is its own token, so the paragraph reflows exactly as it will when finished.
 */
export function Typewriter({
  text,
  onDone,
  onType,
}: {
  text: string
  onDone: () => void
  onType?: () => void
}) {
  const reduced = usePrefersReducedMotion()
  const words = text.split(/(\s+)/)
  const [shown, setShown] = useState(0)

  // biome-ignore lint/correctness/useExhaustiveDependencies: restart only when the text changes; the callbacks are per render
  useEffect(() => {
    if (reduced) {
      onDone()
      return
    }
    setShown(0)
    let index = 0
    const id = setInterval(() => {
      index += 1
      setShown(index)
      onType?.()
      if (index >= words.length) {
        clearInterval(id)
        onDone()
      }
    }, WORD_MS)
    return () => clearInterval(id)
  }, [text, reduced])

  if (reduced) return <>{text}</>
  return (
    <>
      {words.slice(0, shown).join('')}
      {shown < words.length && <span className="sd-caret" aria-hidden />}
    </>
  )
}

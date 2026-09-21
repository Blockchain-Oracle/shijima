'use client'

import { webCopy } from '@desk/shared'
import { Moon, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'
import { resolveTheme, type Theme, toggleTheme } from '@/lib/theme'

/** Flips the cream light and ink dark themes. From Yosuku via Agari; only the words are ours. */
export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('dark')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setTheme(resolveTheme())
    setMounted(true)
  }, [])

  // A stable placeholder until mounted, so the server and the browser draw the same thing.
  if (!mounted) return <button type="button" className="theme-toggle" aria-hidden="true" tabIndex={-1} />

  const isDark = theme === 'dark'
  return (
    <button
      type="button"
      className="theme-toggle"
      data-cursor="hover"
      onClick={() => setTheme(toggleTheme(theme))}
      aria-label={isDark ? webCopy.theme.toLight : webCopy.theme.toDark}
      title={isDark ? webCopy.theme.light : webCopy.theme.dark}
    >
      {isDark ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
    </button>
  )
}

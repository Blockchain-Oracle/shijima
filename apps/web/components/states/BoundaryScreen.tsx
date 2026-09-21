'use client'

import { webCopy } from '@desk/shared'
import { useEffect } from 'react'

interface BoundaryScreenProps {
  error: Error & { digest?: string }
  reset: () => void
  backHref?: string
  /** Fills the viewport when there is no shell around it (the root boundary). */
  root?: boolean
}

/** The error boundary's face, from Yosuku's `app/error.tsx` via Agari: calm, with a retry and a way out. */
export function BoundaryScreen({ error, reset, backHref = '/markets', root = false }: BoundaryScreenProps) {
  useEffect(() => {
    console.error(error)
  }, [error])
  const technical = error.digest ? `${error.message} (digest ${error.digest})` : error.message
  return (
    <div className={root ? 'boundary boundary-root' : 'boundary'} role="alert">
      <h1 className="boundary-title">{webCopy.states.boundary.headline}</h1>
      <p className="boundary-body">{webCopy.states.boundary.body}</p>
      <div className="boundary-actions">
        <button type="button" className="boundary-retry" onClick={() => reset()} data-cursor="hover">
          {webCopy.states.retry}
        </button>
        <a href={backHref} className="boundary-out" data-cursor="hover">
          {webCopy.states.back}
        </a>
      </div>
      <details className="boundary-details">
        <summary>{webCopy.states.technical}</summary>
        <pre>{technical}</pre>
      </details>
    </div>
  )
}

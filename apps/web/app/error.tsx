'use client'

import { appCopy } from '@desk/shared'
import Link from 'next/link'

/** A page that failed to render. The money is on the chain, not in this page, and the reader is told so. */
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  const c = appCopy.error
  return (
    <div className="app-container nf">
      <p className="nf-code">500</p>
      <h1 className="nf-title">{c.title}</h1>
      <p className="nf-body">{c.body}</p>
      <div className="nf-actions">
        <button type="button" className="btn-primary ov-btn" onClick={reset}>
          {c.retry}
        </button>
        <Link href="/" className="btn-secondary ov-btn">
          {c.home}
        </Link>
      </div>
    </div>
  )
}

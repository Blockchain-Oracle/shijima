'use client'

import { settingsCopy } from '@desk/shared'
import { Check, Copy, Link2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { shareAction } from '@/app/owner-actions'

const s = settingsCopy.share
const g = settingsCopy.sharing

export interface ShareState {
  enabled: boolean
  slug: string | null
}

/** Turn the link on or off; the same slug comes back each time. Shared with the copy card, which needs it on. */
export async function setShare(
  deskId: string,
  share: ShareState,
  enabled: boolean,
): Promise<ShareState | null> {
  const done = await shareAction(deskId, enabled)
  return done.ok ? { enabled, slug: done.slug ?? share.slug } : null
}

/**
 * The public beta link, shown independently of the owner’s copy-trading permission.
 */
export function ShareToggle({ deskId, share }: { deskId: string; share: ShareState }) {
  const [copied, setCopied] = useState(false)
  // Read after mounting, so the server and the browser draw the same first frame.
  const [origin, setOrigin] = useState<string | null>(null)
  useEffect(() => setOrigin(window.location.origin), [])
  const url = origin ? `${origin}/agents/${share.slug ?? deskId}` : null

  return (
    <section className="sh-card" data-on="" aria-labelledby="sh-link-title">
      <header className="sh-head">
        <span className="sh-chip" aria-hidden="true">
          <Link2 />
        </span>
        <div className="sh-titles">
          <span className="sh-step">{g.step(1)}</span>
          <h3 id="sh-link-title">{g.linkTitle}</h3>
        </div>
        <span className="sh-pill" data-on="">
          <i aria-hidden="true" />
          {g.linkOn}
        </span>
      </header>
      <p className="sh-body">{s.body}</p>
      {url && (
        <div className="sh-url">
          <input readOnly value={url} aria-label={s.title} onFocus={(e) => e.currentTarget.select()} />
          <button
            type="button"
            className="sh-url-copy"
            onClick={() => {
              void navigator.clipboard.writeText(url)
              setCopied(true)
              setTimeout(() => setCopied(false), 1500)
            }}
          >
            {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
            {copied ? s.copied : s.copy}
          </button>
        </div>
      )}
    </section>
  )
}

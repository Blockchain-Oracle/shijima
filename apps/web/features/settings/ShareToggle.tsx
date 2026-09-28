'use client'

import { settingsCopy } from '@desk/shared'
import { Check, Copy, Link2 } from 'lucide-react'
import { useEffect, useState, useTransition } from 'react'
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
 * Step 1, the read-only link (design brief 8.19), after 21st's Feature Toggle Switch Cards (22208): an icon chip,
 * the title and a status pill, then the link itself. Its control is a button, not a switch, so it never reads as
 * the same thing as the copy switch below it.
 */
export function ShareToggle({
  deskId,
  share,
  onChange,
}: {
  deskId: string
  share: ShareState
  onChange: (next: ShareState) => void
}) {
  const [copied, setCopied] = useState(false)
  const [pending, start] = useTransition()
  // Read after mounting, so the server and the browser draw the same first frame.
  const [origin, setOrigin] = useState<string | null>(null)
  useEffect(() => setOrigin(window.location.origin), [])
  const url = share.enabled && share.slug && origin ? `${origin}/agents/${share.slug}` : null

  const flip = () =>
    start(async () => {
      const next = await setShare(deskId, share, !share.enabled)
      if (next) onChange(next)
    })

  return (
    <section className="sh-card" data-on={share.enabled ? '' : undefined} aria-labelledby="sh-link-title">
      <header className="sh-head">
        <span className="sh-chip" aria-hidden="true">
          <Link2 />
        </span>
        <div className="sh-titles">
          <span className="sh-step">{g.step(1)}</span>
          <h3 id="sh-link-title">{g.linkTitle}</h3>
        </div>
        <span className="sh-pill" data-on={share.enabled ? '' : undefined}>
          <i aria-hidden="true" />
          {share.enabled ? g.linkOn : g.linkOff}
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
      <div className="sh-foot">
        <button
          type="button"
          className={share.enabled ? 'st-btn st-btn--sm' : 'st-btn st-btn--sm st-btn--primary'}
          onClick={flip}
          disabled={pending}
        >
          {share.enabled ? s.turnOff : s.turnOn}
        </button>
      </div>
    </section>
  )
}

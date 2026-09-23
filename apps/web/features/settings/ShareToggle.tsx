'use client'

import { settingsCopy } from '@desk/shared'
import { useEffect, useState, useTransition } from 'react'
import { shareAction } from '@/app/owner-actions'
import { Button } from '@/components/ui/button'

const s = settingsCopy.share

/** The read-only link (design brief 8.19): on or off, and the same link every time it comes back on. */
export function ShareToggle({
  deskId,
  initial,
}: {
  deskId: string
  initial: { enabled: boolean; slug: string | null }
}) {
  const [share, setShare] = useState(initial)
  const [copied, setCopied] = useState(false)
  const [pending, start] = useTransition()
  // Read after mounting, so the server and the browser draw the same first frame.
  const [origin, setOrigin] = useState<string | null>(null)
  useEffect(() => setOrigin(window.location.origin), [])
  const url = share.enabled && share.slug && origin ? `${origin}/agents/${share.slug}` : null

  const flip = () =>
    start(async () => {
      const done = await shareAction(deskId, !share.enabled)
      if (done.ok) setShare({ enabled: !share.enabled, slug: done.slug ?? share.slug })
    })

  return (
    <div className="flex flex-col gap-3">
      <p className={share.enabled ? 'type-body text-profit' : 'type-body text-ink-secondary'}>
        {share.enabled ? s.on : s.off}
      </p>
      {url && (
        <div className="desk-input">
          <input readOnly value={url} aria-label={s.title} onFocus={(e) => e.currentTarget.select()} />
          <button
            type="button"
            className="type-caption text-accent"
            onClick={() => {
              void navigator.clipboard.writeText(url)
              setCopied(true)
              setTimeout(() => setCopied(false), 1500)
            }}
          >
            {copied ? s.copied : s.copy}
          </button>
        </div>
      )}
      <Button size="sm" variant={share.enabled ? 'secondary' : 'default'} onClick={flip} disabled={pending}>
        {share.enabled ? s.turnOff : s.turnOn}
      </Button>
    </div>
  )
}

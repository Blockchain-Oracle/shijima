'use client'

import { appCopy } from '@desk/shared'
import { Copy } from 'lucide-react'
import type { Route } from 'next'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { type CopyQuoteResult, copyQuoteAction } from '@/app/copy-actions'
import { SignInButton } from '@/components/shell/SignInButton'
import { Modal } from '@/components/ui/modal'

const c = appCopy.copy
const usd = (raw: string) => `$${(Number(raw) / 1e6).toFixed(2)}`

/**
 * "Copy this agent": a dialog that says, before anything is signed, what copying is, what it costs and who gets
 * the fee, then hands over to the studio to make the owner's own agent from this one's mix. When copying is not
 * possible it says why, instead of greying the button out (Agari's S23 lesson).
 */
export function CopyButton({
  leaderSlug,
  signedIn,
  autoOpen = false,
}: {
  leaderSlug: string
  signedIn: boolean
  autoOpen?: boolean
}) {
  const [open, setOpen] = useState(autoOpen)
  const [quote, setQuote] = useState<CopyQuoteResult | null>(null)

  useEffect(() => {
    if (!open || quote) return
    copyQuoteAction(leaderSlug)
      .then(setQuote)
      .catch(() => setQuote({ ok: false, why: c.refused.failed }))
  }, [open, quote, leaderSlug])

  return (
    <>
      <button type="button" className="btn-primary copy-btn" onClick={() => setOpen(true)}>
        <Copy aria-hidden="true" className="size-4" /> {c.button}
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        eyebrow={c.dialog.eyebrow}
        title={quote?.ok ? c.dialog.title(quote.name) : c.button}
        closeLabel="Close"
      >
        {!quote ? (
          <p className="copy-muted">…</p>
        ) : !quote.ok ? (
          <p className="copy-why">{quote.why}</p>
        ) : quote.mine ? (
          <div className="copy-body">
            <p className="copy-muted">{c.dialog.yours}</p>
            <Link href={`/agents/${quote.leaderSlug}/settings` as Route} className="btn-secondary ov-btn">
              {c.dialog.settings}
            </Link>
          </div>
        ) : (
          <div className="copy-body">
            <ol className="copy-how">
              {c.dialog.how.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ol>
            <div className="copy-fee">
              <span>{c.dialog.fee}</span>
              <strong>{quote.feeUsdg === '0' ? c.dialog.free : usd(quote.feeUsdg)}</strong>
              {quote.feeUsdg !== '0' && (
                <small>{c.dialog.split(usd(quote.creatorUsdg), usd(quote.platformUsdg))}</small>
              )}
            </div>
            <p className="copy-muted">{c.dialog.trading}</p>
            {signedIn ? (
              <Link href={`/agents/new?copy=${quote.leaderSlug}` as Route} className="btn-primary ov-btn">
                {c.dialog.continue} →
              </Link>
            ) : (
              <div className="copy-signin">
                <p className="copy-muted">{c.dialog.signIn}</p>
                <SignInButton />
              </div>
            )}
          </div>
        )}
      </Modal>
    </>
  )
}

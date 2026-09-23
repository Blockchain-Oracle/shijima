'use client'

import { Dialog } from '@base-ui/react/dialog'
import { APPROVED_TOKENS } from '@desk/chain'
import { takesCopy } from '@desk/shared'
import { XIcon } from 'lucide-react'
import Link from 'next/link'
import { useRef, useState } from 'react'
import { SignInButton } from '@/components/shell/SignInButton'
import { toast } from '@/components/ui/toast'
import { AssetDisc } from '@/features/markets/marks'
import { normalizeText, TAKE_MAX } from '@/features/social/protocol'
import { usePostTake } from './useTakes'

const C = takesCopy.composer

export type SocialViewer = 'signed_out' | 'no_desk' | 'member'

/**
 * "Post a take", from Agari (`features/takes/TakeComposer.tsx`), with the betting taken out: no side, no line, no
 * horizon. What is left is which stock it is about, the words, and whether to show that your desk holds it. The
 * sheet follows the theme, as the Room's does. Base UI's Dialog brings the focus trap and the dialog role.
 */
export function TakeComposer({
  viewer,
  initialSymbol,
  onClose,
}: {
  viewer: SocialViewer
  initialSymbol: string
  onClose: () => void
}) {
  const { post, busy, error } = usePostTake()
  const sheetRef = useRef<HTMLDivElement>(null)
  const [symbol, setSymbol] = useState(initialSymbol)
  const [caption, setCaption] = useState('')
  const [holds, setHolds] = useState(false)
  const canPost = viewer === 'member' && !busy && normalizeText(caption, TAKE_MAX).length > 0

  const submit = async () => {
    if (!canPost) return
    const posted = await post({ symbol, caption: normalizeText(caption, TAKE_MAX), holds })
    if (posted) {
      toast.add({ title: C.posted })
      onClose()
    }
  }

  return (
    <Dialog.Root
      open
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="take-scrim" />
        <Dialog.Popup ref={sheetRef} initialFocus={sheetRef} className="take-sheet" aria-label={C.title}>
          <div className="take-sheet-hairline" aria-hidden />
          <div className="take-sheet-body">
            <div className="take-sheet-head">
              <Dialog.Title className="take-sheet-title">{C.title}</Dialog.Title>
              <Dialog.Close className="take-sheet-close" aria-label={C.close} data-cursor="hover">
                <XIcon size={18} />
              </Dialog.Close>
            </div>
            <p className="take-sheet-where">{C.where}</p>

            <div className="take-horizon">
              <div className="take-horizon-label">{C.stock}</div>
              <div className="take-horizon-grid">
                {APPROVED_TOKENS.map((t) => (
                  <button
                    key={t.symbol}
                    type="button"
                    onClick={() => setSymbol(t.symbol)}
                    data-on={symbol === t.symbol}
                    data-cursor="hover"
                  >
                    {t.symbol}
                  </button>
                ))}
              </div>
            </div>

            <div className="take-words">
              <textarea
                value={caption}
                onChange={(event) => setCaption(event.target.value.slice(0, TAKE_MAX))}
                placeholder={C.placeholder}
                rows={3}
                maxLength={TAKE_MAX}
                aria-label={C.placeholder}
              />
              <div className="take-count">
                {caption.length}/{TAKE_MAX}
              </div>
            </div>

            <label className="take-holds-toggle">
              <input type="checkbox" checked={holds} onChange={(event) => setHolds(event.target.checked)} />
              {C.holds(symbol)}
            </label>

            <div className="take-preview">
              <div className="take-preview-label">{takesCopy.pill}</div>
              <div className="take-preview-call">
                <span className="take-chip take-preview-chip">
                  <AssetDisc symbol={symbol} className="take-chip-mark" />
                  <span className="take-chip-band">
                    <span className="take-chip-tag">${symbol}</span>{' '}
                    {APPROVED_TOKENS.find((t) => t.symbol === symbol)?.displayName}
                  </span>
                </span>
              </div>
            </div>

            {error && <p className="take-error">{error}</p>}

            {viewer === 'signed_out' ? (
              <div className="take-connect">
                <p className="take-state-body">{C.connect}</p>
                <SignInButton />
              </div>
            ) : viewer === 'no_desk' ? (
              <div className="take-connect">
                <p className="take-state-body">{C.noDesk}</p>
                <Link href="/agents/new" className="take-post" data-cursor="hover">
                  {takesCopy.startDesk}
                </Link>
              </div>
            ) : (
              <button
                type="button"
                className="take-post"
                onClick={() => void submit()}
                disabled={!canPost}
                data-cursor="hover"
              >
                {busy ? C.posting : C.post}
              </button>
            )}
            <p className="take-permanence">{C.permanence}</p>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

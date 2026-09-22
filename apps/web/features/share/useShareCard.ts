'use client'

import { shareCopy } from '@desk/shared'
import { useCallback, useState } from 'react'
import { toast } from '@/components/ui/toast'

export interface ShareInput {
  render: () => Promise<Blob>
  fileName: string
  text: string
}

/**
 * Agari's share flow (`features/share/useShareCard.ts`): draw the PNG, hand it to the native share sheet when the
 * platform takes files, otherwise download it and open a pre-filled post so the reader can attach the image.
 *
 * The path is decided synchronously, inside the click, so the post's tab can be opened before any await: a late
 * `window.open` is blocked as a pop-up once drawing has taken more than a beat.
 */
export function useShareCard() {
  const [busy, setBusy] = useState(false)

  const share = useCallback(
    async ({ render, fileName, text }: ShareInput) => {
      if (busy) return
      setBusy(true)

      const probe = new File([new Uint8Array(8)], 'probe.png', { type: 'image/png' })
      const canNativeShare =
        typeof navigator !== 'undefined' &&
        typeof navigator.canShare === 'function' &&
        navigator.canShare({ files: [probe] })
      let intentWin: Window | null = null
      if (!canNativeShare && typeof window !== 'undefined') {
        intentWin = window.open('about:blank', '_blank')
        if (intentWin) intentWin.opener = null
      }
      const closeIntentWin = () => {
        try {
          intentWin?.close()
        } catch {
          // cross-origin after navigation: ignore
        }
      }

      try {
        const blob = await render()
        const file = new File([blob], fileName, { type: 'image/png' })
        const intentUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(text)}`

        if (canNativeShare && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({ files: [file], text })
            return
          } catch (error) {
            if ((error as DOMException)?.name === 'AbortError') return // the reader closed the sheet
            // fall through to download and the post
          }
        }

        const url = URL.createObjectURL(blob)
        const anchor = document.createElement('a')
        anchor.href = url
        anchor.download = fileName
        document.body.appendChild(anchor)
        anchor.click()
        anchor.remove()
        setTimeout(() => URL.revokeObjectURL(url), 30_000)

        if (intentWin) {
          intentWin.location.href = intentUrl
          intentWin = null // handed off: do not close it
        } else {
          // Only reached when the native path failed late; a blocker may eat this open. The PNG is saved either
          // way, so say what the reader has.
          const opened = window.open(intentUrl, '_blank', 'noopener,noreferrer')
          if (!opened) toast.add({ title: shareCopy.savedAttach })
        }
      } catch (error) {
        console.warn('[share] card failed:', error)
        toast.add({ title: shareCopy.renderFailed, type: 'error' })
      } finally {
        closeIntentWin()
        setBusy(false)
      }
    },
    [busy],
  )

  return { busy, share }
}

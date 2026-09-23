'use client'

import { settingsCopy } from '@desk/shared'
import { Check, QrCode, Send } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useState, useTransition } from 'react'
import {
  type TelegramState,
  telegramCodeAction,
  telegramStateAction,
  telegramUnlinkAction,
} from '@/app/owner-actions'
import { Button } from '@/components/ui/button'
import { Qr as QrSvg } from '@/components/ui/qr'
import { cn } from '@/lib/utils'

const t = settingsCopy.telegram
const POLL_MS = 2000

/**
 * Connect Telegram in one click (design brief 8.8). The one-time code is made as soon as this appears, so the
 * button is a plain link into @ShijimaBot: nothing to copy, and no pop-up for a browser to block. The page
 * watches for the bot to claim the code and turns to "Connected as @name" within a couple of seconds. A code
 * lasts ten minutes; a page left open gets a fresh one. A QR code is there for a phone beside the computer.
 */
export function TelegramConnect({
  deskId,
  initial,
  compact = false,
}: {
  deskId: string
  /** From the server when the page has it; fetched here otherwise. */
  initial?: TelegramState
  /** One line with the button, for the desk's "Needs you" strip. */
  compact?: boolean
}) {
  const reduced = useReducedMotion()
  const [state, setState] = useState<TelegramState | undefined>(initial)
  const [clicked, setClicked] = useState(false)
  const [showQr, setShowQr] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const code = state?.pending?.code ?? null
  const expiresAt = state?.pending?.expiresAt ? new Date(state.pending.expiresAt).getTime() : 0

  // Have a live code ready before anyone clicks, and replace it once it has run out.
  useEffect(() => {
    if (state?.linked) return
    if (code && expiresAt - Date.now() > 30_000) return
    let gone = false
    telegramCodeAction(deskId)
      .then(async (made) => {
        if (gone) return
        if (!made.ok) return setProblem(made.why)
        const next = await telegramStateAction(deskId).catch(() => null)
        if (!gone && next) setState(next)
      })
      .catch(() => undefined)
    return () => {
      gone = true
    }
  }, [deskId, state?.linked, code, expiresAt])

  // Watch for the bot to claim the code. Faster once the owner has pressed the button.
  useEffect(() => {
    if (!code || state?.linked) return
    const timer = setInterval(
      async () => {
        const next = await telegramStateAction(deskId).catch(() => null)
        if (next) setState(next)
      },
      clicked ? POLL_MS : POLL_MS * 3,
    )
    return () => clearInterval(timer)
  }, [code, state?.linked, deskId, clicked])

  if (state?.linked) {
    return (
      <motion.div
        initial={reduced ? false : { opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className={cn('flex flex-wrap items-center gap-3', compact && 'justify-between')}
      >
        <span className="inline-flex items-center gap-2 text-[13px] text-[var(--profit)]">
          <span className="flex size-5 items-center justify-center rounded-full bg-[var(--color-profit-wash)]">
            <Check className="size-3" aria-hidden />
          </span>
          {t.connected(state.linked.username)}
        </span>
        {!compact && (
          <Button
            size="sm"
            variant="secondary"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const done = await telegramUnlinkAction(deskId)
                if (done.ok) {
                  setState({ linked: null, pending: null })
                  setClicked(false)
                  setNote(t.disconnected)
                }
              })
            }
          >
            {t.disconnect}
          </Button>
        )}
      </motion.div>
    )
  }

  const link = code ? `https://t.me/${t.bot}?start=${code}` : null
  return (
    <div className="flex flex-col gap-3">
      {note && <p className="type-caption text-ink-secondary">{note}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <a
          href={link ?? undefined}
          target="_blank"
          rel="noreferrer"
          aria-disabled={!link}
          onClick={(e) => {
            if (!link) e.preventDefault()
            else setClicked(true)
          }}
          data-cursor="hover"
          className={cn(
            'inline-flex h-10 items-center gap-2 rounded-[var(--radius-md)] bg-[#229ED9] px-4 text-[14px] font-medium text-white transition-opacity hover:opacity-90',
            !link && 'pointer-events-none opacity-50',
          )}
        >
          <Send className="size-4" aria-hidden />
          {clicked ? t.openAgain : t.connect}
        </a>
        {link && !compact && (
          <button
            type="button"
            onClick={() => setShowQr((v) => !v)}
            aria-expanded={showQr}
            className="inline-flex h-10 items-center gap-1.5 rounded-[var(--radius-md)] border border-border px-3 text-[13px] text-muted-foreground hover:text-foreground"
          >
            <QrCode className="size-4" aria-hidden />
            {t.qr}
          </button>
        )}
      </div>
      <AnimatePresence initial={false}>
        {showQr && link && code && (
          <motion.div
            initial={reduced ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
            className="settings-telegram overflow-hidden"
          >
            <QrSvg label={t.scan} text={link} />
            <div className="flex flex-col gap-2">
              <p className="type-caption text-ink-secondary">{t.scan}</p>
              <p className="type-caption text-ink-muted">{t.orSend(code)}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {clicked && (
        <p className="inline-flex items-center gap-2 type-caption text-ink-secondary" role="status">
          <span className="size-1.5 animate-pulse rounded-full bg-[#229ED9]" aria-hidden />
          {t.waitingPress}
        </p>
      )}
      {problem && <p className="type-caption text-loss">{problem}</p>}
      {!compact && <p className="type-caption text-ink-muted">{t.without}</p>}
    </div>
  )
}
